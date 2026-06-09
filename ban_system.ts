import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import { BlockSystem } from "../Interfaces/database_types.js";

class BlockSystemRepository {
    async getAll(): Promise<BlockSystem[]> {
        const { rows: data } = await database.query<BlockSystem>(
            `SELECT * FROM blocksystem`
        );

        return data;
    }

    /**
     * Fetch how many people the member has blocked
     */
    async blockedByMemberCount(guildId: Snowflake, memberId: Snowflake): Promise<number> {
        const { rows: [{ count }] } = await database.query(
            `SELECT COUNT(*) AS count FROM blocksystem WHERE guild=$1 AND blocker=$2`,
            [guildId, memberId]
        );

        return Number(count);
    }

    /**
     * Array of all users blocked by this member
     */
    async getMemberBlockList(guildId: Snowflake, memberId: Snowflake): Promise<string[]> {
        const { rows: data } = await database.query<BlockSystem>(
            `SELECT blocked FROM blocksystem WHERE guild=$1 AND blocker=$2`,
            [guildId, memberId]
        );

        const ids = data.map(row => row.blocked);
        return ids;
    }

    /**
     * String array of all members that are blocking or being blocked by the memberId provided
     * 
     * Mutual restricted represents all the ids of members that can not interact with memberId through 
     * 
     * some features of the bot such as autovoice.
     */
    async getMutualRestrictedList(guildId: Snowflake, memberId: Snowflake): Promise<string[]> {
        const { rows: data } = await database.query(
            `SELECT DISTINCT
                CASE
                    WHEN blocker=$2 THEN blocked
                    ELSE blocker
                END AS user_id
            FROM blocksystem
            WHERE guild=$1 AND (blocker=$2 OR blocked=$2);`,
            [guildId, memberId]
        );

        const blockedIds = data.map(d => d.user_id);
        return blockedIds;
    }

    /**
     * Blocker member blocks Blocked member
     */
    async addBlock(guildId: Snowflake, blocker: Snowflake, blocked: Snowflake) {
        await database.query(
            `INSERT INTO blocksystem(guild, blocker, blocked)
                VALUES($1, $2, $3)
                ON CONFLICT (guild, blocker, blocked)
                DO NOTHING;`,
            [guildId, blocker, blocked]
        );
    }

    /**
     * Remove the block a blocker has given to a blocked
     */
    async removeBlock(guildId: Snowflake, blocker: Snowflake, blocked: Snowflake) {
        await database.query(`DELETE FROM blocksystem WHERE guild=$1 AND blocker=$2 AND blocked=$3`,
            [guildId, blocker, blocked]
        );
    }
}

const BlockSystemRepo = new BlockSystemRepository();
export default BlockSystemRepo;