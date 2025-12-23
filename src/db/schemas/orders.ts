import { pgTable, text,uuid ,timestamp, pgEnum, decimal, jsonb, integer} from "drizzle-orm/pg-core";
import { users } from "./users";
import { product_variants } from "./products";


export const orderStatusEnum = pgEnum('status',[
  'created', 
  'payment_pending', 
  'paid', 
  'shipped', 
  'delivered', 
  'cancelled',
]);

export const orders = pgTable('orders', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('userId').references(() => users.id, { onDelete: 'restrict' }).notNull(),
    status: orderStatusEnum('status').default('created').notNull(),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
    taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }).notNull(),
    
    // The Snapshot (Typed for Drizzle)
    shippingAddress: jsonb('shipping_address').$type<{
        fullName: string,
        line1: string,
        line2?: string,
        city: string,
        state: string,
        postalCode: string,
        country: string,
        phone: string
    }>().notNull(),
    paymentReference: text('payment_reference').unique(), // External ID from Stripe/Razorpay
    
    // Audit Timestamps
    paidAt: timestamp('paid_at'), 
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const order_items = pgTable('order_items',{
    id:uuid('id').defaultRandom().primaryKey(),
    variantId:uuid('variant_id').references(()=>product_variants.id,{onDelete:'restrict'}).notNull(),
    orderId:uuid('order_id').references(()=>orders.id,{onDelete:'restrict'}).notNull(),
    quantity:integer('quantity').notNull(),
    priceAtPurchase:decimal('price_at_purchase', { precision: 12, scale: 2 }).notNull(),
})