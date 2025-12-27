import { sql } from "drizzle-orm";
import { db } from "../db/db";
import { categories } from "../db/schemas";

export const getDescendantCategoryIds = async (categorySlug: string): Promise<string[]> => {
    // 1. Get the starting category ID from the slug
    const [startCategory] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(sql`${categories.slug} = ${categorySlug}`);

    if (!startCategory) return [];

    // 2. Recursive query to find all children, grandchildren, etc.
    const result = await db.execute(sql`
    WITH RECURSIVE category_tree AS (
      SELECT id FROM ${categories} WHERE id = ${startCategory.id}
      UNION ALL
      SELECT c.id FROM ${categories} c
      INNER JOIN category_tree ct ON ct.id = c.parent_id
    )
    SELECT id FROM category_tree;
  `);

    return result.rows.map((row: any) => row.id);
};