import type { CategoryChannel, Snowflake } from "discord.js";
import database from "../Config/database.js";
import { SelfCache } from "../Config/SelfCache.js";

const clanSystemCache = new SelfCache<Snowflake, Snowflake>(24 * 60 * 60_000); // 1 day

class ClanSystemRepository {
    /**
     * Fetch the category id that hosts the clan system
     */
    async getCategory(guildId: Snowflake): Promise<Snowflake | null> {
        const cache = clanSystemCache.get(guildId);
        if(cache) return cache;

        const {rows: data} = await database.query(`SELECT category FROM clansystem WHERE guild=$1`, [ guildId ]);
        if(data.length && data[0]) {
            clanSystemCache.set(guildId, data[0].category);
            return data[0].category;
        } else {
            return null;
        }
    }

    /**
     * Insert or update the category
     */
    async setCategory(guildId: Snowflake, channelId: Snowflake) {
        clanSystemCache.set(guildId, channelId);
        await database.query(
            `INSERT INTO clansystem (guild, category)
                VALUES($1, $2)
                ON CONFLICT (guild, category)
                    DO UPDATE SET
                        category = EXCLUDED.category`,
            [guildId, channelId]
        );
    }

    /**
     * Delete the configuration.
     */
    async delete(guildId: Snowflake) {
        clanSystemCache.delete(guildId);
        await database.query(`DELETE FROM clansystem WHERE guild=$1`, [ guildId ]);
    }

    /**
     * Handle the event of deleting the category of the clan system.
     * 
     * Clear the guild configuration for the clan system.
     */
    async onCategoryDelete(guildId: Snowflake, category: CategoryChannel) {
        const { rowCount } = await database.query(
            `DELETE FROM clansystem WHERE guild=$1 AND category=$2`,
            [ guildId, category.id ]
        );

        // if anything was deleted, clear the cache for the guild
        if(rowCount && rowCount > 0) clanSystemCache.delete(guildId);
    }
}

const ClanSystemRepo = new ClanSystemRepository();
export default ClanSystemRepo;