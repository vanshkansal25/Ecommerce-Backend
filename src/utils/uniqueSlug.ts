import slugify from "slugify";
import { eq, like } from "drizzle-orm";
import { db } from "../db/db";

export async function generateUniqueSlug(name: string, table: any): Promise<string> {
    const baseSlug = slugify(name, { lower: true, strict: true });

    // 1. Look for slugs that start with this baseSlug
    const existing = await db.select()
        .from(table)
        .where(like(table.slug, `${baseSlug}%`));

    if (existing.length === 0) return baseSlug;

    // 2. If it exists, append a count
    return `${baseSlug}-${existing.length + 1}`;
}

