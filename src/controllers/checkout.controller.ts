import { db } from "../db/db";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { ApiResponse } from "../utils/apiResponse";
import { NextFunction, Request, Response } from "express";
import { carts, idempotencyKeys, order_items, orders, product_inventory } from "../db/schemas";
import { and, eq, gte, sql } from "drizzle-orm";
import { redis } from "../utils/redis";
import { inventoryQueue } from "../Queues/inventory.queue";



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
        await inventoryQueue.add(
            "expire-order",
            { orderId: newOrder.id, userId },
            { delay: 15 * 60 * 1000 }
        );
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
