import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { db } from "../db/db";
import { cart_items, carts } from "../db/schemas";
import { eq, sql } from "drizzle-orm";
import { ApiResponse } from "../utils/apiResponse";
import { redis } from "../utils/redis";







// add cart
export const addCart = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { variantId, quantity } = req.body;
    const userId = req.user?.id;
    if (!userId) {
        return next(new Error("Unauthorized"));
    }
    const cacheKey = `cart:${userId}`
    const cart = await db.transaction(async (tx) => {
        // Find or Create Cart (ensure 1:1 relation)
        let userCart = await tx.query.carts.findFirst({
            where: eq(carts.userId, userId),
        });
        if (!userCart) {
            [userCart] = await tx.insert(carts).values({ userId }).returning();
        }
        const item = await tx
            .insert(cart_items)
            .values({
                cartId: userCart.id,
                variantId,
                quantity,
            })
            .onConflictDoUpdate({
                target: [cart_items.cartId, cart_items.variantId],
                set: {
                    quantity: sql`${cart_items.quantity} + ${quantity}`,
                },
            }) // onConflictDoUpdate means if that cart item exists dont add another just increment value by 1;
            .returning();
        // CACHE INVALIDATION
        // After a successful DB update, delete the old cache.
        // The next GET request will fetch fresh data from DB and re-cache it.
        await redis.del(cacheKey);
        return { cartId: userCart.id, item: item[0] };
    })
    return res.status(200).json(
        new ApiResponse(200, cart, "Item added to cart successfully")
    );
})
// removeItemFromCart
// updateItemFromCart
// getCart

export const getCart = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
        return next(new Error("Unauthorized"));
    }

    const cacheKey = `cart:${userId}`;
    const cachedCart = await redis.get(cacheKey);
    if (cachedCart) {
        return res.status(200).json(
            new ApiResponse(200, JSON.parse(cachedCart), "Cart fetched from cache")
        );
    }
    const userCart = await db.query.carts.findFirst({
        where: eq(carts.userId, userId),
        with: {
            items: {
                with: {
                    variant: {
                        with: {
                            product: true // Get name, description, etc.
                        }
                    }
                }
            }
        }
    });

    if (!userCart) {
        return res.status(200).json(
            new ApiResponse(200, { items: [] }, "Empty cart")
        );
    }
    await redis.setex(cacheKey, 86400, JSON.stringify(userCart));
    return res.status(200).json(
        new ApiResponse(200, userCart, "Cart fetched from database")
    );

})