
import { pgTable, text, uuid, timestamp, boolean, pgEnum, index } from "drizzle-orm/pg-core";
import { relations } from 'drizzle-orm';
export const userRoles = pgEnum('user_roles', [
    'USER',
    'ADMIN',
])

export const users = pgTable("users", {
    id: uuid('id').defaultRandom().primaryKey(),
    displayName: text('displayName').notNull(),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    role: userRoles('role').notNull().default('USER'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})
export const refreshTokens = pgTable('refreshToken', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('userId').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires-at').notNull(),
    isRevoked: boolean('is_revoked').notNull().default(false),

})
export const addresses = pgTable('addresses', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('userId').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
    address_line1: text('address_line1').notNull(),
    address_line2: text('address_line2').notNull(),
    city: text('city').notNull(),
    state: text('state').notNull(),
    country: text('country').notNull(),
    pincode: text('pincode').notNull(),
    phone: text('phone').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const usersRelations = relations(users, ({ one, many }) => ({
    address: one(addresses, {
        fields: [users.id],
        references: [addresses.userId],
    }),
    refreshTokens: many(refreshTokens),
}));

// 2. Relations for Refresh Tokens
export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
    user: one(users, {
        fields: [refreshTokens.userId],
        references: [users.id],
    }),
}));

// 3. Relations for Addresses
export const addressesRelations = relations(addresses, ({ one }) => ({
    user: one(users, {
        fields: [addresses.userId],
        references: [users.id],
    }),
}));