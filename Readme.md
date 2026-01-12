#  High-Performance E-Commerce Engine

A **scalable, production-ready e-commerce backend** built with **Node.js**, **TypeScript**, and **PostgreSQL**, powered by **Drizzle ORM**.  
Designed to handle **high-concurrency events** such as flash sales, limited product drops, and complex inventory operations.

---

## Tech Stack

| Category        | Technology |
|-----------------|------------|
| Runtime         | Node.js + TypeScript |
| Database        | PostgreSQL (Supabase) |
| ORM             | Drizzle ORM (Relational API) |
| Caching         | Redis (Cache-Aside Pattern) |
| Async Jobs      | BullMQ  |
| Security        | JWT, Bcrypt, Role-Based Access Control (RBAC) |
| Payments        | **Stripe API (Synchronous Verification Flow)** |

---

## Core Architecture & Key Features

### **1. Identity & Access Management (IAM)**
-  **JWT Authentication** with secure cookie storage.
-  **Role-Based Access Control (RBAC)** to protect admin/customer routes.
- Example: Only admins can restock inventory; customers can manage their cart.

---

### **2. Advanced Product Discovery**
-  **Optimized Retrieval**: Fetch products by slug with nested variants & inventory in a single query.
-  **Fast Search**: Indexed `name` & `description` for sub-100ms search results.
-  **Pagination & Sorting**: Flexible listing API supporting dynamic sorting and metadata-rich pagination.

---

### **3. "Flash Sale" Inventory Logic**
-  **Atomic Operations**: Prevents overselling using SQL-level increments/decrements.
- **Stock Reservation**: Items are "held" during checkout and permanently deducted only after payment.
-  **Concurrency Guard**: `gte` checks in SQL WHERE clauses to prevent race conditions.
-  **Data Integrity**: Unique constraints on SKU prevent duplicate entries.

---

### **4. Scalable Shopping Cart**
-  **1:1 User-Cart Mapping** enforced via DB constraints.
-  **Atomic Upserts**: `onConflictDoUpdate` merges quantities for duplicates.
-  **Cache-Aside Pattern**: Reads served from Redis, writes update Postgres + invalidate cache.
-  **Deep Relations**: Fetch Cart → Items → Variants → Products in one query using Drizzle.

---

### **5. High-Performance Product Catalog**
-  **Slug-based SEO URLs** for products.
-  **Complex Relations**: Products → Variants → Inventory.
-  **Redis Caching**: Sub-10ms response times for product details.

---
### **6. Distributed Order Lifecycle (BullMQ)**
- **Automatic Stock Recovery**: A "Reaper" worker reclaims reserved stock if payment fails or no confirmation within **15 minutes**.
- **Job Cleanup**: Payment success triggers job deletion to avoid overhead.
- **Resilience**: Workers persist via Redis and survive server restarts.

---

### **7. Bulletproof Payment & Idempotency**
- **Idempotency Layer**: Prevents duplicate order creation or double-charging (custom `idempotency_keys` table).
- **State Machine**: Order transitions → `created → payment_pending → paid / cancelled`.
- **Secure Payment Verification**: Order is finalized **only** after server-side Stripe confirmation (`payment_intent.succeeded`).
---
### **8. API Protection & Rate Limiting**
- **Rate Limiting Middleware** applied at the API gateway level.
- Protects against brute-force attacks, abuse, and traffic spikes.
- Different rate limits for:
  - Public routes (product browsing)
  - Auth routes (login/register)
  - Sensitive routes (checkout, payment confirmation)
- Helps maintain system stability during flash sales and peak traffic.
---

## API Endpoints (Quick Look)

| Resource     | Method | Endpoint | Description | Auth |
|-------------|--------|----------|-------------|------|
| **Auth** | POST | `/api/v1/auth/register` | User registration | Public |
| | POST | `/api/v1/auth/login` | User login | Public |
| | POST | `/api/v1/auth/logout` | User logout | Private |
| | POST | `/api/v1/auth/refresh-token` | Generate new access token | Private |
| | POST | `/api/v1/auth/change-password` | Change user password | Private |
| **Product** | GET | `/api/v1/products/get-products` | List products with cache, sort, filters | Public |
| | GET | `/api/v1/products/get-product/:slug` | Cached detailed view | Public |
| | POST | `/api/v1/products/create-product` | Create new product | Private (Admin) |
| | PUT | `/api/v1/products/update-product/:productId` | Update product details | Private (Admin) |
| | DELETE | `/api/v1/products/delete-product/:productId` | Delete product | Private (Admin) |
| **Category** | GET | `/api/v1/categories/tree` | Get category tree | Public |
| | GET | `/api/v1/categories/slug/:slug` | Get category by slug | Public |
| | POST | `/api/v1/categories/create-category` | Create new category | Private (Admin) |
| | PUT | `/api/v1/categories/update-category/:id` | Update category | Private (Admin) |
| **Inventory / Stock** | POST | `/api/v1/stock/add-stock` | Add physical stock | Private (Admin) |
| | POST | `/api/v1/stock/update-stock` | Update stock level | Private |
| | POST | `/api/v1/stock/sync-reserved-stock` | Sync reserved stock | Private |
| | GET | `/api/v1/stock/get-stock-level/:variantId` | Real-time stock level | Public/Private* |
| **Cart** | POST | `/api/v1/cart/add-cart` | Add/increment item in cart (cache invalidated) | Private |
| | GET | `/api/v1/cart/get-cart` | Get full cart (Redis optimized) | Private |
| **Checkout** | POST | **`/api/v1/checkout/`** | Initial checkout (reserve stock, create order, start BullMQ timer) | Private |
| **Checkout** | POST | **`/api/v1/checkout/create-payment-intent`** | Stripe handshake, generates client secret | Private |
| **Checkout** | POST | **`/api/v1/checkout/confirm-payment`** | Final settlement, Stripe server-verified | Private |
| **Orders** | GET | `/api/v1/orders/my-orders` | Get all orders for logged-in user | Private |
| | GET | `/api/v1/orders/my-orders/:orderId` | Get single order details | Private |
| **Sales / Analytics** | GET | `/api/v1/sales/*` | Sales analytics & metrics dashboard | Private (Admin) |


## Performance Benchmarks (Local)

| Operation | Latency |
|-----------|---------|
| Search | ~45ms (Postgres Indexing) |
| Cart Read | <5ms (Redis Cache Hit) |
| Product Details | ~10ms (Redis Cache Hit) |
| Create Order + Reserve Stock | <30ms (Transaction Optimized) |

---

##  Engineering Principles Applied
-  **Race Condition Prevention**: All inventory math happens in DB, no "check then update" in JS.
-  **Type Safety**: End-to-end TypeScript interfaces from schema.
-  **Performance First**: Redis caching, atomic writes, optimized queries.
- **Atomic State Transitions**: Order & payment updates are transaction-bound.
- **Distributed Task Management**: BullMQ worker queue for order expiry.
- **Payment Security**: Zero trust — frontend confirmation not accepted without Stripe server validation.
- **API Hardening**: Rate limiting, auth guards, and role checks at route level.
---

## Vision
To build a **production-ready, high-concurrency e-commerce backend** that demonstrates:

- Scalable architecture
- Transaction-safe inventory logic
- Advanced caching and query optimization
- Type-safe, maintainable, and modern backend design

