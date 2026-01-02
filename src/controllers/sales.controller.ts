import { sum, count, desc, eq } from "drizzle-orm";
import { Request, Response } from "express";
import { db } from "../db/db";
import { order_items, orders } from "../db/schemas";
import { ApiResponse } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export const getSalesStats = asyncHandler(async (req: Request, res: Response) => {
    const [revenueResult] = await db
        .select({ totalRevenue: sum(orders.totalAmount) })
        .from(orders)
        .where(eq(orders.status, 'paid'));
    const [orderCount] = await db
        .select({ count: count() })
        .from(orders);
    const bestSellers = await db
        .select({
            variantId: order_items.variantId,
            totalSold: sum(order_items.quantity).mapWith(Number),
        })
        .from(order_items)
        .innerJoin(orders, eq(order_items.orderId, orders.id))
        .where(eq(orders.status, 'paid'))
        .groupBy(order_items.variantId)
        .orderBy(desc(sum(order_items.quantity)))
        .limit(5);

    return res.status(200).json(
        new ApiResponse(200, {
            revenue: revenueResult?.totalRevenue || 0,
            totalOrders: orderCount?.count || 0,
            topProducts: bestSellers
        }, "Admin stats retrieved")
    );
});