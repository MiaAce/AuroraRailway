import type { Result } from "pg";

import database from '../Config/database.js';
import type { ClanSystem } from "../Interfaces/database_types.js";

export default async function ClanSystem(): Promise<Result<ClanSystem>> {
    try{
        const result: Result<ClanSystem> = await database.query(
            `CREATE TABLE IF NOT EXISTS clansystem(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                category BIGINT NOT NULL,
                CONSTRAINT guild_clansystem_unique UNIQUE (guild, category)
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}