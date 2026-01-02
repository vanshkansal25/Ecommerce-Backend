import { pgTable, uuid, text, timestamp, decimal, integer, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { orders } from "./orders";
import { relations } from "drizzle-orm";

export const paymentStatusEnum = pgEnum('payment_status', [
    'pending',
    'completed',
    'failed',
    'cancelled',
])



export const payments = pgTable('payments', {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'restrict' }).notNull(),
    transactionId: text('transaction_id').notNull().unique(),
    status: paymentStatusEnum('status').default('pending').notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('USD'),
    provider: text('provider').notNull(),
    // Essential for debugging failed webhooks
    rawResponse: jsonb('raw_response'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const idempotency_keysStatus = pgEnum('idempotency_keys_status', [
    'started',
    'completed',
])
export const idempotencyKeys = pgTable('idempotency_keys', {
    id: uuid('id').defaultRandom().primaryKey(),
    key: text('key').notNull().unique(), // The unique request/event ID
    status: idempotency_keysStatus('status').notNull().default('started'), // 'started', 'completed'
    handlerOutput: jsonb('handler_output'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});


// 1. Relations for Orders (Update your existing orders relations)
export const orderRelations = relations(orders, ({ many }) => ({
    payments: many(payments),
}));

// 2. Relations for Payments
export const paymentsRelations = relations(payments, ({ one }) => ({
    order: one(orders, {
        fields: [payments.orderId],
        references: [orders.id],
    }),
}));