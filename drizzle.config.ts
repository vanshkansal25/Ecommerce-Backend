import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './src/db/schemas/index.ts',
    out: './drizzle', // Directory where migration files will be created
    dialect: 'postgresql',
    dbCredentials: {
        // Drizzle Kit needs the connection string to perform migrations
        url: process.env.DATABASE_URL!,
    },
    // Optionally, you can enable verbose logging for Drizzle Kit
    verbose: true,
    strict: true,
});