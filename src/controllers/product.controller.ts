import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { generateUniqueSlug } from "../utils/uniqueSlug";
import { product_inventory, product_variants, products } from "../db/schemas";
import { db } from "../db/db";
import { ApiResponse } from "../utils/apiResponse";
import { eq, inArray } from "drizzle-orm";


interface VariantInput {
    sku: string;
    attributes: any;
    price: number | string;
    initialStock?: number;
    lowStockThreshold?: number;
}

interface ProductInput {
    name: string;
    categoryId: string;
    description: string;
    variants: VariantInput[];
}

interface UpdateProductBody {
    name?: string;
    description?: string;
    isActive: boolean,
    categoryId?: string;
    variants?: {
        id?: string;              // If present → update existing
        sku: string;
        attributes: any;
        price: number | string;
        initialStock?: number;
        lowStockThreshold?: number
    }[];
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
                attributes: v.attributes,
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
export const updateProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { productId } = req.params;
    const data: UpdateProductBody = req.body;
    if (!productId) {
        throw new ApiError(400, "Product ID is required");
    }
    const result = await db.transaction(async (tx) => {
        const [existingProuct] = await tx.select().from(products).where(eq(products.id, productId));
        if (!existingProuct) {
            throw new ApiError(404, "Product not found");
        }
        await tx.update(products).set({
            ...(data.name && { name: data.name }),
            ...(data.description && { description: data.description }),
            ...(data.categoryId && { categoryId: data.categoryId }),
            ...(typeof data.isActive === "boolean" && { isActive: data.isActive }),
            updatedAt: new Date()
        }).where(eq(products.id, productId));

        const existingVariants = await tx.select().from(product_variants).where(eq(product_variants.productId, productId));
        const existingVariantsId = existingVariants.map(v => v.id);
        if (!data.variants) {
            throw new ApiError(400, "Variants are required");
        }
        const sentVariantIds = data.variants.filter(v => v.id).map(v => v.id);

        //existingVariants: fetch all product variants from DB.
        //existingVariantIds: list of their IDs.
        //sentVariantIds: IDs user sent (only existing ones).
        // Compare both to know:
        // which to update
        // which to create
        // which to delete

        const variantsToDelete = existingVariantsId.filter(id => !sentVariantIds.includes(id));
        if (variantsToDelete.length > 0) {
            await tx.delete(product_variants).where(inArray(product_variants.id, variantsToDelete));
            await tx.delete(product_inventory).where(inArray(product_inventory.variantId, variantsToDelete));
        }
        // Delete variants that exist in DB but were removed in the request,
        // along with their corresponding inventory entries


        const incomingSkus = data.variants.map(v => v.sku);
        if (new Set(incomingSkus).size !== incomingSkus.length) {
            throw new ApiError(400, "Duplicate SKUs found in request");
        }

        for (const v of data.variants) {
            const price = v.price.toString();
            const attributes = v.attributes;

            //Update existing variant
            if (v.id) {
                await tx.update(product_variants)
                    .set({
                        sku: v.sku,
                        price,
                        attributes,
                        updatedAt: new Date()
                    })
                    .where(eq(product_variants.id, v.id));
            }

            //Insert new variant + inventory
            else {
                const [newVariant] = await tx.insert(product_variants).values({
                    productId: productId,
                    sku: v.sku,
                    price,
                    attributes
                }).returning();

                await tx.insert(product_inventory).values({
                    variantId: newVariant.id,
                    stockQuantity: v.initialStock || 0,
                    reservedQuantity: 0,
                    lowStockThreshold: v.lowStockThreshold || 5
                });
            }
        }
        return { success: true };
    })
    return res.status(201).json(new ApiResponse(201, result, "Product updated successfully"))
})
export const deleteProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!id) throw new ApiError(400, "Product ID is required");

    const result = await db.transaction(async (tx) => {
        const [existingProduct] = await tx
            .select()
            .from(products)
            .where(eq(products.id, id))
            .limit(1);

        if (!existingProduct) {
            throw new ApiError(404, "Product not found");
        }

        // Perform Soft Delete
        const [deletedProduct] = await tx
            .update(products)
            .set({
                isActive: false,
                updatedAt: new Date()
            })
            .where(eq(products.id, id))
            .returning();
        await tx
            .update(product_variants)
            .set({ updatedAt: new Date() })
            .where(eq(product_variants.productId, id));

        return deletedProduct;
    });

    return res.status(200).json(
        new ApiResponse(200, { id: result.id }, "Product successfully deactivated (Soft Delete)")
    );
});