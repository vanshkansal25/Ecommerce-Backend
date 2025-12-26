import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { generateUniqueSlug } from "../utils/uniqueSlug";
import { product_inventory, product_variants, products } from "../db/schemas";
import { db } from "../db/db";
import { ApiResponse } from "../utils/apiResponse";


interface VariantInput {
    sku: string;
    attributes: Record<string, any>;
    initialStock?: number;
    lowStockThreshold?: number;
    price: number | string;
}

interface ProductInput {
    name: string;
    description: string;
    categoryId: string;
    variants: VariantInput[];
}

export const createProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const data: ProductInput = req.body;
    if (!data.name || !data.description || !data.categoryId || !Array.isArray(data.variants)) {
        throw new ApiError(400, "Invalid Input Data");
    }
    // Pre-Transaction SKU Check (Performance optimization)
    const skus = data.variants.map(v => v.sku);
    if (new Set(skus).size !== skus.length) {
        throw new ApiError(400, "Duplicate SKUs found in your request");
    }
    const slug = await generateUniqueSlug(data.name, products);
    const result = await db.transaction(async (tx) => {
        const [product] = await tx.insert(products).values({
            name: data.name,
            description: data.description,
            categoryId: data.categoryId,
            slug: slug,
        }).returning({ id: products.id });

        const variantResults = [];

        for (const v of data.variants) {
            if (!v.attributes || !v.price || !v.sku) {
                throw new ApiError(400, "Invalid Input Data");
            }
            const [variant] = await tx.insert(product_variants).values({
                productId: product.id,
                sku: v.sku,
                attributes: JSON.stringify(v.attributes),
                price: v.price.toString(),
            }).returning({ id: product_variants.id });
            await tx.insert(product_inventory).values({
                variantId: variant.id,
                stockQuantity: v.initialStock || 0,
                reservedQuantity: 0,
                lowStockThreshold: v.lowStockThreshold || 5,
            });
            variantResults.push({ variantId: variant.id, sku: v.sku })
        }

        return {
            message: "Product created successfully",
            productId: product.id,
            variants: variantResults,
        };
    })
    return res.status(201).json(new ApiResponse(201, result, "Product created successfully"));
})
export const updateProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => { })
export const deleteProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => { })