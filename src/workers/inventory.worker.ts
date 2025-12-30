import { Worker, Job } from "bullmq"
import { redis } from "../utils/redis";
import { db } from "../db/db";
import { INVENTORY_QUEUE } from "../Queues/inventory.queue";
import { eq, sql } from "drizzle-orm";
import { order_items, orders, product_inventory } from "../db/schemas";


export const inventoryWorker = new Worker(INVENTORY_QUEUE,
    async (job: Job) => {
        const { orderId } = job.data;
        console.log(`[Worker] Checking expiration for Order: ${orderId}`);
        await db.transaction(async (tx) => {
            const order = await tx.query.orders.findFirst({
                where: eq(orders.id, orderId)
            })
            if (!order || (order.status !== "created" && order.status !== "payment_pending")) {
                console.log(`[Worker] Order ${orderId} is already processed or paid. Skipping.`);
                return;
            }
            const itemsToRelease = await tx.query.order_items.findMany({
                where: eq(order_items.orderId, orderId)
            })
            for (const item of itemsToRelease) {
                await tx.update(product_inventory)
                    .set({
                        stockQuantity: sql`${product_inventory.stockQuantity} + ${item.quantity}`,
                        reservedQuantity: sql`${product_inventory.reservedQuantity} - ${item.quantity}`,
                        updatedAt: new Date(),
                    })
                    .where(eq(product_inventory.variantId, item.variantId));
            }
            await tx.update(orders)
                .set({ status: "cancelled", updatedAt: new Date() })
                .where(eq(orders.id, orderId));

            console.log(`[Worker] Inventory released and Order ${orderId} marked as EXPIRED.`);
        })
    },
    {
        connection: redis,
    }
)

inventoryWorker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
});
