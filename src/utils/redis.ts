import { Redis } from "ioredis";


export const redis = new Redis({
    host: "localhost",
    port: 6379,
})

redis.on('connect', () => console.log('Redis Connected'));
redis.on('error', (err) => console.error('Redis Error', err));

export const cacheData = async (key: string, data: any, ttl: 3600) => {
    await redis.setex(key, ttl, JSON.stringify(data));
}

export const getCachedData = async <T>(key: string): Promise<T | null> => {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
};

export const invalidateProductCache = async () => {
    const keys = await redis.keys('products:list:*');
    if (keys.length > 0) {
        await redis.del(...keys);
        console.log('Product Cache Cleared');
    }
};