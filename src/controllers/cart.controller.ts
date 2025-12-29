import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { db } from "../db/db";
import { cart_items, carts } from "../db/schemas";
import { and, eq, sql } from "drizzle-orm";
import { ApiResponse } from "../utils/apiResponse";
import { redis } from "../utils/redis";
import { ApiError } from "src/utils/apiError";
// add cart
export const addCart = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { variantId, quantity } = req.body;
    const userId = req.user?.id;
    if (!userId) {
        return next(new ApiError(401, "Unauthorized"));
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
// updateItemFromCart
export const updateCartQuantity = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { variantId, quantity } = req.body; // New absolute quantity (e.g., set to 5)
    const userId = req.user?.id;
    if (!userId) {
        return next(new ApiError(401, "Unauthorized"));
    }

    if (quantity < 1) {
        throw new ApiError(400, "Quantity must be at least 1. Use remove to delete item.");
    }
    await db.transaction(async (tx) => {
        const userCart = await tx.query.carts.findFirst({
            where: eq(carts.userId, userId),
        });

        if (!userCart) throw new ApiError(404, "Cart not found");
        const updatedItem = await tx
            .update(cart_items)
            .set({ quantity: quantity })
            .where(
                and(
                    eq(cart_items.cartId, userCart.id),
                    eq(cart_items.variantId, variantId)
                )
            )
            .returning();

        if (updatedItem.length === 0) {
            throw new ApiError(404, "Item not found in cart");
        }
        await redis.del(`cart:${userId}`);
    });

    return res.status(200).json(new ApiResponse(200, {}, "Cart quantity updated"));
});
// removeItemFromCart
export const removeFromCart = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { variantId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
        return next(new ApiError(401, "Unauthorized"));
    }
    await db.transaction(async (tx) => {
        const userCart = await tx.query.carts.findFirst({
            where: eq(carts.userId, userId),
        });

        if (!userCart) throw new ApiError(404, "Cart not found");

        const deleted = await tx
            .delete(cart_items)
            .where(
                and(
                    eq(cart_items.cartId, userCart.id),
                    eq(cart_items.variantId, variantId)
                )
            )
            .returning();
        if (deleted.length === 0) {
            throw new ApiError(404, "Item not found in cart");
        }
        await redis.del(`cart:${userId}`);
    });

    return res.status(200).json(new ApiResponse(200, {}, "Item removed from cart"));
});
// getCart
export const getCart = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
        return next(new ApiError(401, "Unauthorized"));
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