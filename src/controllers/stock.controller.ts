import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { db } from "../db/db";
import { product_inventory } from "../db/schemas";
import { and, eq, gte, sql } from "drizzle-orm";
import { ApiResponse } from "../utils/apiResponse";




// in case of sale or selling product -> i will not substract the product directly we will mantain a reserved quantity if user cancel the order then we will add the reserved quantity back to the stock 
export const updateStock = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { variantId, quantity } = req.body;
    if (!variantId || quantity <= 0) {
        throw new ApiError(400, "Invalid Input Data");
    }
    const result = await db.update(product_inventory).set({
        // Atomic subtraction: stock = stock - quantity
        stockQuantity: sql`${product_inventory.stockQuantity} - ${quantity}`,
        // Atomic addition: reserved = reserved + quantity
        reservedQuantity: sql`${product_inventory.reservedQuantity} + ${quantity}`,
        updatedAt: new Date(),
    }).where(and(
        eq(product_inventory.variantId, variantId),
        // Only update if we have enough stock!
        gte(product_inventory.stockQuantity, quantity)
    )).returning();

    // If result is empty, it means the 'where' clause failed (Insufficient Stock)
    if (result.length === 0) {
        throw new ApiError(409, "Flash Sale Update Failed: Insufficient stock available.");
    }
    return res
        .status(200)
        .json(new ApiResponse(200, result[0], "Stock reserved successfully"));
})

