import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { db } from "../db/db";
import { generateUniqueSlug } from "../utils/uniqueSlug";
import { categories } from "../db/schemas";
import { eq, sql } from "drizzle-orm";
import { ApiResponse } from "../utils/apiResponse";
import { buildTree } from "../utils/tree";
import { ApiError } from "../utils/apiError";


// export const checkCircular = async (parent:any,parentId:any)=>{
//     let node = parent;
//     while(node != null){
//         if(node === parentId){
//             return true;
//         }
//         const category = await db.select().from(categories).where(eq(categories.id,node));
//         if(!category){
//             return false;
//         }
//         node = category[0].parentId;
//     }
//     return false;
// }

export const createCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { name, parentId } = req.body;
    if (!name) {
        return next(new Error('Name is required'));
    }
    const result = await db.transaction(async (tx) => {
        const slug = await generateUniqueSlug(name, categories);
        const parent = await tx.select().from(categories).where(eq(categories.id, parentId));
        if (!parent) {
            return next(new ApiError(404, 'Parent category not found'));
        }
        // const isCircular = await checkCircular(parent[0].parentId,parentId);
        // if(isCircular){
        //     return next(new Error('Circular reference detected'));
        // }
        const [newCategory] = await tx.insert(categories).values({
            name: name,
            slug: slug,
            parentId: parentId || null, // Ensure it's null if not provided
        }).returning();

        return newCategory;

    })
    return res.status(201).json(new ApiResponse(201, result, "Category created Successfully"));

})
export const updateCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { name, parentId } = req.body;

    const result = await db.transaction(async (tx) => {
        // 1. Check if the category exists
        const [existingCategory] = await tx.select().from(categories).where(eq(categories.id, id)).limit(1);
        if (!existingCategory) throw new ApiError(404, "Category not found");

        // 2. SELF-REFERENCE CHECK: A category cannot be its own parent
        if (parentId === id) {
            throw new ApiError(400, "A category cannot be its own parent.");
        }

        // 3. DESCENDANT CHECK
        if (parentId) {
            const descendants = await tx.execute(sql`
                WITH RECURSIVE subordinates AS (
                    SELECT id FROM ${categories} WHERE parent_id = ${id}
                    UNION ALL
                    SELECT c.id FROM ${categories} c
                    INNER JOIN subordinates s ON s.id = c.parent_id
                )
                SELECT id FROM subordinates;
            `);
            const descendantIds = descendants.rows.map((row: any) => row.id);
            if (descendantIds.includes(parentId)) {
                throw new ApiError(400, "Logical Error: You cannot move a category inside one of its own sub-categories.");
            }
        }
        const [updatedCategory] = await tx.update(categories)
            .set({
                name: name ?? existingCategory.name,
                parentId: parentId !== undefined ? parentId : existingCategory.parentId,
                updatedAt: new Date()
            })
            .where(eq(categories.id, id))
            .returning();

        return updatedCategory;
    });

    return res.status(200).json(new ApiResponse(200, result, "Category updated successfully"));
});
export const getCategoryTree = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const query = sql`
    WITH RECURSIVE category_tree AS (
      -- Base Case: Get all Root categories (parent_id is NULL)
      SELECT id, name, slug, parent_id, 1 as level
      FROM ${categories}
      WHERE parent_id IS NULL

      UNION ALL

      -- Recursive Step: Join children to their parents
      SELECT c.id, c.name, c.slug, c.parent_id, ct.level + 1
      FROM ${categories} c
      INNER JOIN category_tree ct ON c.parent_id = ct.id
    )
    SELECT * FROM category_tree ORDER BY level, name;
  `;
    const result = await db.execute(query);
    const nested = buildTree(result.rows);
    return res.status(200).json(new ApiResponse(200, nested, "Category tree fetched Successfully"));
})
export const getCategoryBySlug = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { slug } = req.params;
    if (!slug || slug.trim().length === 0) {
        return next(new ApiError(400, 'Slug is required'));
    }
    const result = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
    if (result.length === 0) {
        return next(new ApiError(404, 'Category not found'));
    }
    return res.status(200).json(new ApiResponse(200, result, "Category fetched Successfully"));
})