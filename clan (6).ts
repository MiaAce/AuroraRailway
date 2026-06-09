import type { Result } from "pg";

import database from '../Config/database.js';
import type { ClanTable } from "../Interfaces/database_types.js";

export default async function ClanTable(): Promise<Result<ClanTable>> {
    try{
        const result: Result<ClanTable> = await database.query(
            `CREATE TABLE IF NOT EXISTS clan(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                owner BIGINT NOT NULL,
                clanname TEXT NOT NULL,
                ownerrole BIGINT NOT NULL,
                clanrole BIGINT NOT NULL,
                voicechannel BIGINT,
                textchannel BIGINT,
                CONSTRAINT clan_guild_owner UNIQUE (guild, owner),
                CONSTRAINT clan_guild_ownerrole UNIQUE (guild, ownerrole),
                CONSTRAINT clan_guild_clanrole UNIQUE (guild, clanrole)
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}