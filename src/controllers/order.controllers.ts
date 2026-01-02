import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { db } from "../db/db";
import { orders } from "../db/schemas";
import { and, desc, eq } from "drizzle-orm";
import { ApiError } from "../utils/apiError";
import { ApiResponse } from "../utils/apiResponse";

export const getUserOrders = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { orderId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
        throw new ApiError(401, "Unauthorized");
    }
    if (orderId) {
        const order = await db.query.orders.findFirst({
            where: and(eq(orders.id, orderId), eq(orders.userId, userId)),
            with: {
                items: {
                    with: {
                        variant: {
                            with: {
                                product: true
                            }
                        }
                    }
                }
            }
        });
        if (!order) {
            throw new ApiError(404, "Order not found");
        }
        return res.status(200).json(new ApiResponse(200, order, "Order retrieved"));
    }
    const allOrders = await db.query.orders.findMany({
        where: eq(orders.userId, userId),
        orderBy: [desc(orders.createdAt)],
    });

    return res.status(200).json(new ApiResponse(200, allOrders, "User orders retrieved"));
})