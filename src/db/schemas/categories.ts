import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { AnyPgColumn } from "drizzle-orm/pg-core";

export const categories = pgTable('categories', {
    id: uuid('id').defaultRandom().primaryKey(),

    // Self-referencing FK for sub-categories
    // Nullable because "Root" categories have no parent
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),

    // Unique slug is mandatory for SEO-friendly URLs
    slug: text('slug').notNull().unique(),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
    return {
        // Index on slug for lightning-fast catalog lookups
        slugIdx: index('category_slug_idx').on(table.slug),
        parentIdx: index('category_parent_idx').on(table.parentId),
    }
    // Without index → full table scan 
    // With index → O(log n) lookup 
    // “Slug is a high-read field, so indexing it avoids full table scans.”
});



export const categoriesRelations = relations(categories, ({ one, many }) => ({
    // This defines the "Parent" of the current category
    parent: one(categories, {
        fields: [categories.parentId],
        references: [categories.id],
        relationName: 'category_hierarchy',
    }),
    // This defines the "Children" (sub-categories)
    children: many(categories, {
        relationName: 'category_hierarchy',
    }),
}));