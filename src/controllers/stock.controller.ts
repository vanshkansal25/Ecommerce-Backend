import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { db } from "../db/db";
import { product_inventory } from "../db/schemas";
import { and, eq, gte, sql } from "drizzle-orm";
import { ApiResponse } from "../utils/apiResponse";


export const addStock = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { variantId, quantity } = req.body; // e.g., { "variantId": "...", "quantity": 100 }

    if (quantity <= 0) {
        throw new ApiError(400, "Invalid Input Data");
    }

    const result = await db
        .update(product_inventory)
        .set({
            // Atomic increment
            stockQuantity: sql`${product_inventory.stockQuantity} + ${quantity}`,
            updatedAt: new Date(),
        })
        .where(eq(product_inventory.variantId, variantId))
        .returning();

    if (result.length === 0) {
        throw new ApiError(404, "Inventory record not found for this variant");
    }

    return res.status(200).json(
        new ApiResponse(200, result[0], `Successfully added ${quantity} units to stock`)
    );
});

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

// The "Undo" Logic for updatedStock: syncReservedStock

export const syncReservedStock = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { variantId, quantity } = req.body;

    // I am "Releasing" stock. 
    // I move it from Reserved -> Back to Stock Quantity.
    const result = await db.update(product_inventory).set({
        stockQuantity: sql`${product_inventory.stockQuantity} + ${quantity}`,
        reservedQuantity: sql`${product_inventory.reservedQuantity} - ${quantity}`,
        updatedAt: new Date(),
    }).where(and(
        eq(product_inventory.variantId, variantId),
        // Safety check: Don't subtract more than what is actually reserved
        sql`${product_inventory.reservedQuantity} >= ${quantity}`
    )).returning();

    if (result.length === 0) {
        throw new ApiError(400, "Sync Failed: Cannot release more stock than is currently reserved.");
    }
    return res
        .status(200)
        .json(new ApiResponse(200, result[0], "Stock released successfully"));
})

// To calculate the Sellable Stock.
export const getStockLevel = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { variantId } = req.params;

    const inventory = await db
        .select({
            available: sql<number>`${product_inventory.stockQuantity} - ${product_inventory.reservedQuantity}`,
            totalPhysical: product_inventory.stockQuantity,
            reserved: product_inventory.reservedQuantity
        })
        .from(product_inventory)
        .where(eq(product_inventory.variantId, variantId))
        .limit(1);

    if (!inventory.length) {
        throw new ApiError(404, "Inventory record not found");
    }

    return res.status(200).json(new ApiResponse(200, inventory[0], "Stock level fetched"));
})