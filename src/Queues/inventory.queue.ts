import { Queue } from "bullmq"
import { redis } from "../utils/redis"


export const INVENTORY_QUEUE = "inventory-cleanup";

export const inventoryQueue = new Queue(INVENTORY_QUEUE, {
    connection: redis,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 1000
        },
        removeOnComplete: true,
    }
})