import { integer, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { product_variants } from "./products";


export const carts = pgTable('carts', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const cart_items = pgTable('cart_items', {
    id: uuid('id').defaultRandom().primaryKey(),
    cartId: uuid('cart_id').references(() => carts.id, { onDelete: 'cascade' }).notNull(),
    variantId: uuid('variant_id').references(() => product_variants.id).notNull(),
    quantity: integer('quantity').notNull().default(1),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
    // Ensures a user doesn't have two rows for the same SKU
    // Instead, just increment the quantity of the existing row
    uniqueItemInCart: unique().on(table.cartId, table.variantId),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
    user: one(users, {
        fields: [carts.userId],
        references: [users.id],
    }),
    items: many(cart_items),
}));

export const cartItemsRelations = relations(cart_items, ({ one }) => ({
    cart: one(carts, {
        fields: [cart_items.cartId],
        references: [carts.id],
    }),
    variant: one(product_variants, {
        fields: [cart_items.variantId],
        references: [product_variants.id],
    }),
}));