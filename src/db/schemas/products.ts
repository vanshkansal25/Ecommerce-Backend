import { boolean, decimal, integer, pgTable, text, timestamp, uuid, index, check, jsonb } from "drizzle-orm/pg-core";
import { categories } from "./categories";
import { sql } from "drizzle-orm";
import { relations } from 'drizzle-orm';

export const products = pgTable('products', {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'restrict' }).notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
    slugIdx: index('products_slug_idx').on(table.slug),
}));

export const product_variants = pgTable('product_variants', {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
    sku: text('sku').notNull().unique(),
    // Using JSONB for attributes to allow {"size": "XL", "color": "Blue"}
    attributes: jsonb('attributes').notNull(),
    price: decimal('price', { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const product_inventory = pgTable('product_inventory', {
    id: uuid('id').defaultRandom().primaryKey(),
    variantId: uuid('variant_id').references(() => product_variants.id, { onDelete: 'cascade' }).notNull().unique(),

    // The "Source of Truth" columns
    stockQuantity: integer('stock_quantity').notNull().default(0),
    reservedQuantity: integer('reserved_quantity').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),

    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
    return {
        // BUSINESS RULE: You can never reserve more than you have, 
        // and stock can never be negative.
        stockCheck: check('stock_check', sql`${table.stockQuantity} >= 0`),
        reserveCheck: check('reserve_check', sql`${table.reservedQuantity} <= ${table.stockQuantity}`),
    }
});





// 1. Products Relations
export const productsRelations = relations(products, ({ one, many }) => ({
    category: one(categories, {
        fields: [products.categoryId],
        references: [categories.id],
    }),
    variants: many(product_variants),
}));

// 2. Variants Relations (The Middle Man)
export const productVariantsRelations = relations(product_variants, ({ one }) => ({
    product: one(products, {
        fields: [product_variants.productId],
        references: [products.id],
    }),
    inventory: one(product_inventory, {
        fields: [product_variants.id],
        references: [product_inventory.variantId],
    }),
}));

// 3. Inventory Relations
export const productInventoryRelations = relations(product_inventory, ({ one }) => ({
    variant: one(product_variants, {
        fields: [product_inventory.variantId],
        references: [product_variants.id],
    }),
}));