import { db } from "../db/db";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { ApiResponse } from "../utils/apiResponse";
import { NextFunction, Request, Response } from "express";
import { carts, idempotencyKeys, order_items, orders, product_inventory } from "../db/schemas";
import { and, eq, gte, sql } from "drizzle-orm";
import { redis } from "../utils/redis";
import { inventoryQueue } from "../Queues/inventory.queue";
import Stripe from "stripe";



// this controller will handle the clear cart after placing order and placing that order in bullmQ for 15 minutes till i get success from payment webhook handler.
export const intialCheckOut = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const { idempotencyKey, shippingAddress } = req.body;
    if (!userId) {
        throw new ApiError(400, "Unauthorized Access")
    }
    if (!idempotencyKey || !shippingAddress) {
        throw new ApiError(400, "Invalid Input Data")
    }
    // check for idempotency key if it exist return from here
    const existingRequest = await db.query.idempotencyKeys.findFirst({
        where: eq(idempotencyKeys.key, idempotencyKey)
    })
    if (existingRequest?.status == 'completed') {
        return res.status(200).json(existingRequest.handlerOutput)
    }
    // now the final order
    const finalOrder = await db.transaction(async (tx) => {
        if (!existingRequest) {
            await tx.insert(idempotencyKeys).values({
                key: idempotencyKey,
                status: 'started',
            })
        }
        // get user cart with the items in it

        const userCart = await tx.query.carts.findFirst({
            where: eq(carts.userId, userId),
            with: {
                items: {
                    with: {
                        variant: true
                    },
                },
            }
        })
        if (!userCart || userCart.items.length === 0) {
            throw new ApiError(400, "Cart is empty")
        }
        // reserve stock 
        for (const item of userCart.items) {
            const reservation = await tx.update(product_inventory).set({
                stockQuantity: sql`${product_inventory.stockQuantity} - ${item.quantity}`,
                reservedQuantity: sql`${product_inventory.reservedQuantity} + ${item.quantity}`,
                updatedAt: new Date()
            }).where(and(
                eq(product_inventory.variantId, item.variantId),
                gte(product_inventory.stockQuantity, item.quantity)
            )).returning();
            if (reservation.length === 0) {
                throw new ApiError(400, `Stock ran out for item: ${item.variantId}`)
            }
        }
        // calculate the total and place order
        const totalAmount = userCart.items.reduce((total, item) => {
            return total + (Number(item.variant.price) * item.quantity);
        }, 0);
        const [newOrder] = await tx.insert(orders).values({
            userId,
            status: 'created',
            totalAmount: totalAmount.toString(),
            taxAmount: '0',
            shippingAddress,
        }).returning()
        // Create Order Items (Snapshotting)
        await tx.insert(order_items).values(
            userCart.items.map(item => ({
                orderId: newOrder.id,
                variantId: item.variantId,
                quantity: item.quantity,
                priceAtPurchase: item.variant.price
            }))
        );
        // clear the cart 
        await tx.delete(carts).where(eq(carts.userId, userId));
        const job = await inventoryQueue.add(
            "expire-order",
            { orderId: newOrder.id, userId },
            { delay: 15 * 60 * 1000 }
        );
        await tx.update(orders)
            .set({ expirationJobId: job.id })
            .where(eq(orders.id, newOrder.id));
        const responseData = new ApiResponse(201, { orderId: newOrder.id }, "Order initiated");
        await tx.update(idempotencyKeys)
            .set({ status: 'completed', handlerOutput: responseData })
            .where(eq(idempotencyKeys.key, idempotencyKey));

        // 5. Redis Cleanup
        await redis.del(`cart:${userId}`);

        return responseData;

    })
    return res.status(201).json(new ApiResponse(201, finalOrder, "Order initiated"));

})

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-12-15.clover',
    typescript: true,
})

export const createPaymentIntent = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { orderId } = req.body;
    const userId = req.user?.id;
    if (!orderId || !userId) {
        throw new ApiError(400, "Invalid Input Data")
    }
    // fetch order and check the ownership
    const order = await db.query.orders.findFirst({
        where: and(eq(orders.id, orderId), eq(orders.userId, userId))
    })
    if (!order) throw new ApiError(404, "Order not found");
    if (order.status !== "created" && order.status !== "payment_pending") {
        throw new ApiError(400, "Order is not in a payable state");
    }
    //Stripe expects amounts in CENTS (Integer)
    //$10.00 becomes 1000. Our decimal is "10.00" string.
    const amountInCents = Math.round(parseFloat(order.totalAmount) * 100);
    const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        metadata: {
            orderId: order.id,
            userId: userId,
        },// so to check when stripe webook hit back , we can get which order is paid
        automatic_payment_methods: { enabled: true },
    }, {
        // this thing will handle the duplicate payments
        idempotencyKey: `payment_intent_${order.id}`
    })

    // update order status to payement_pending
    await db.update(orders).set({
        status: "payment_pending",
        paymentReference: paymentIntent.id,
    }).where(eq(orders.id, orderId))


    return res.status(200).json(
        new ApiResponse(
            200,
            { clientSecret: paymentIntent.client_secret },//clientSecret is used because it is the secure way for the frontend to complete a payment
            "Payment intent created"
        )
    );
})
