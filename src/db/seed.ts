import { db } from "./db";
import { categories, products, product_variants, product_inventory } from "./schemas";

async function main() {
    console.log("⏳ Starting Mega-Seed (500 Products)...");

    // 1. CLEANUP
    await db.delete(product_inventory);
    await db.delete(product_variants);
    await db.delete(products);
    await db.delete(categories);

    // 2. CREATE CATEGORIES
    const cats = await db.insert(categories).values([
        { name: "Electronics", slug: "electronics" },
        { name: "Clothing", slug: "clothing" },
        { name: "Footwear", slug: "footwear" },
    ]).returning();

    const productData = [];

    console.log("📦 Generating data structures...");

    // 3. GENERATE 500 PRODUCTS
    for (let i = 1; i <= 500; i++) {
        const selectedCat = cats[i % cats.length];

        // We use a batch insert later for speed, but for relations 
        // we'll do this in chunks or a loop for ID clarity.
        const [product] = await db.insert(products).values({
            name: `Premium ${selectedCat.name} Item #${i}`,
            slug: `item-slug-${i}-${Math.floor(Math.random() * 1000)}`,
            description: `This is a high-quality product from our ${selectedCat.name} collection.`,
            categoryId: selectedCat.id,
            isActive: true,
        }).returning();

        // 4. CREATE 2 VARIANTS PER PRODUCT
        const variantInputs = [
            {
                productId: product.id,
                sku: `SKU-${i}-A`,
                price: (Math.random() * (500 - 10) + 10).toFixed(2), // Price between 10 and 500
                attributes: { color: "Standard", size: "M" },
            },
            {
                productId: product.id,
                sku: `SKU-${i}-B`,
                price: (Math.random() * (1000 - 501) + 501).toFixed(2), // Price between 501 and 1000
                attributes: { color: "Premium", size: "L" },
            }
        ];

        const insertedVariants = await db.insert(product_variants).values(variantInputs).returning();

        // 5. CREATE INVENTORY FOR EACH
        const inventoryInputs = insertedVariants.map(v => ({
            variantId: v.id,
            stockQuantity: Math.floor(Math.random() * 100),
            lowStockThreshold: 5,
        }));

        await db.insert(product_inventory).values(inventoryInputs);

        if (i % 100 === 0) console.log(`🚀 Seeded ${i} products...`);
    }

    console.log("✅ Mega-Seed Successful! 500 Products, 1000 Variants created.");
    process.exit(0);
}

main().catch(console.error);