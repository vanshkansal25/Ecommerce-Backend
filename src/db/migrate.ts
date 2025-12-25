import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './db'; // Import the db client and pool initialized earlier

async function main() {
    console.log('--- Starting database migration ---');

    try {
        // The migrate function uses the connection pool to execute the SQL files
        // found in the 'drizzle' directory (as configured in drizzle.config.ts)
        await migrate(db, { migrationsFolder: './drizzle' });

        console.log('✅ Migration complete!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        // Crucially, you must end the connection pool after the migration is done
        await pool.end();
    }
}

main();