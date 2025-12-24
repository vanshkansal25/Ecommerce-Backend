import "dotenv/config"
import { Pool } from "pg";
import * as schema from './schemas/index'
import  {drizzle}  from "drizzle-orm/node-postgres";




const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
}

const pool = new Pool({
    connectionString,

})

export const db = drizzle(pool,{schema,logger:true});


export {pool};