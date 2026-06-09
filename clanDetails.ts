import { Role, TextChannel, VoiceChannel, type Snowflake } from "discord.js";
import { SelfCache } from "../Config/SelfCache.js";
import database from "../Config/database.js";
import { ClanTable } from "../Interfaces/database_types.js";

const clanCache = new SelfCache<string, ClanTable>(60 * 60_000); // 1h
// the key is represented by the string "<guild_id>:<owner_id>"

class ClanRepository {
    /**
     * Replace the row with the one provided
     */
    async updateByOwner(clanTable: ClanTable) {
        await database.query(
            `UPDATE clan SET clanname=$3, ownerrole=$4, clanrole=$5, voicechannel=$6, textchannel=$7
                WHERE guild=$1 AND owner=$2`,
            [
                clanTable.guild, clanTable.owner, clanTable.clanname, clanTable.ownerrole,
                clanTable.clanrole, clanTable.voicechannel, clanTable.textchannel
            ]
        );
        clanCache.set(`${clanTable.guild}:${clanTable.owner}`, clanTable);
    }
    /**
     * Fetch all clans from the guild
     * 
     * Populates the cache.
     */
    async guildClans(guildId: Snowflake): Promise<ClanTable[]> {
        const cache = clanCache.getByValue((_, key) => key.startsWith(guildId));
        if(cache && cache.length > 0) return cache;

        const { rows: data } = await database.query<ClanTable>(`SELECT * FROM clan WHERE guild=$1`, [ guildId ]);
        for(const row of data) {
            clanCache.set(`${guildId}:${row.owner}`, row);
        }

        return data;
    }
    /**
     * Fetch all guild rows and return the count.
     * 
     * Also populates the cache.
     */
    async guildClansCount(guildId: Snowflake): Promise<number> {
        const allClansCache = clanCache.getByValue((_, key) => key.startsWith(guildId));
        if (allClansCache) return allClansCache.length;

        const { rows: data } = await database.query<ClanTable>(
            `SELECT * FROM clan WHERE guild=$1`,
            [guildId]
        );

        for (const row of data) { // update cache
            clanCache.set(`${guildId}:${row.owner}`, row);
        }

        return data.length;
    }

    /**
     * Fetch a clan row by the owner id in the guild
     */
    async getByOwner(guildId: Snowflake, memberId: Snowflake): Promise<ClanTable | null> {
        const key = `${guildId}:${memberId}`;
        const cache = clanCache.get(key);
        if (cache) return cache;

        const { rows: data } = await database.query<ClanTable>(
            `SELECT * FROM clan WHERE guild=$1 AND owner=$2`,
            [guildId, memberId]
        );

        if (data && data[0]) {
            clanCache.set(key, data[0]);
            return data[0];
        } else {
            return null;
        }
    }

    /**
     * Fetch the clan by clan name
     */
    async getByClanName(guildId: Snowflake, clanName: string): Promise<ClanTable | null> {
        const cache = clanCache.getByValue((value, key) => key.startsWith(guildId) && value.clanname === clanName);
        if(cache && cache[0]) return cache[0];

        const { rows: data } = await database.query<ClanTable>(
            `SELECT * FROM clan WHERE guild=$1 AND clanname=$2`,
            [ guildId, clanName ]
        );

        if(data && data[0]) {
            clanCache.set(`${guildId}:${data[0].owner}`, data[0]);
            return data[0];
        } else {
            return null;
        }
    }

    /**
     * Delete the owner's clan from the guild
     */
    async deleteByOwner(guildId: Snowflake, memberId: Snowflake) {
        clanCache.delete(`${guildId}:${memberId}`);
        await database.query(`DELETE FROM clan WHERE guild=$1 AND owner=$2`, [guildId, memberId]);
    }

    /**
     * Return whether the role is in use by a clan.
     */
    async isRoleInUse(guildId: Snowflake, roleId: Snowflake) {
        const cache = clanCache.getByValue((value, key) =>
            key.startsWith(guildId) &&
            (value.ownerrole === roleId || value.clanrole === roleId)
        );

        if (cache !== undefined && cache.length) return true;

        const { rows: data } = await database.query<ClanTable>(
            `SELECT * FROM clan WHERE guild=$1 AND (ownerrole=$2 OR clanrole=$2)`,
            [guildId, roleId]
        );

        if (data.length) {
            for (const row of data) {
                clanCache.set(`${guildId}:${row.owner}`, row);
            }
            return true;
        } else {
            return false;
        }
    }

    /**
     * Return whether the channel is in use by a clan
     */
    async isChannelInUse(guildId: Snowflake, channelId: Snowflake) {
        const cache = clanCache.getByValue((value, key) =>
            key.startsWith(guildId) &&
            (value.textchannel === channelId || value.voicechannel === channelId)
        );

        if (cache !== undefined && cache.length) return true;

        const { rows: data } = await database.query<ClanTable>(
            `SELECT * FROM clan WHERE guild=$1 AND (textchannel=$2 OR voicechannel=$2)`,
            [guildId, channelId]
        );

        if (data.length) {
            for (const row of data) {
                clanCache.set(`${guildId}:${row.owner}`, row);
            }
            return true;
        } else {
            return false;
        }
    }

    /**
     * Register a new clan
     */
    async registerClan(clanTable: ClanTable) {
        clanCache.set(`${clanTable.guild}:${clanTable.owner}`, clanTable);
        await database.query(
            `INSERT INTO clan (guild, owner, clanname, ownerrole, clanrole)
                VALUES($1, $2, $3, $4, $5)`,
            [clanTable.guild, clanTable.owner, clanTable.clanname, clanTable.ownerrole, clanTable.clanrole]
        );
    }

    /**
     * Set the text channel of the clan owner
     */
    async setTextChannel(guildId: Snowflake, memberId: Snowflake, channelId: Snowflake | null) {
        const key = `${guildId}:${memberId}`;
        const cache = clanCache.get(key);
        if(cache) {
            cache.textchannel = channelId;
            clanCache.set(key, cache);
        }
        await database.query(
            `UPDATE clan SET textchannel=$3 WHERE guild=$1 AND owner=$2`,
            [ guildId, memberId, channelId ]
        );
    }

    /**
     * Set the voice channel of the clan owner
     */
    async setVoiceChannel(guildId: Snowflake, memberId: Snowflake, channelId: Snowflake | null) {
        const key = `${guildId}:${memberId}`;
        const cache = clanCache.get(key);
        if(cache) {
            cache.voicechannel = channelId;
            clanCache.set(key, cache);
        }
        await database.query(
            `UPDATE clan SET voicechannel=$3 WHERE guild=$1 AND owner=$2`,
            [ guildId, memberId, channelId ]
        );
    }

    /**
     * Handle the removal of data about the textchannel or voicechannel of a clan upon deletion
     * 
     * The voice or text channel is nullified in database
     */
    async onClanChannelDelete(guildId: Snowflake, channel: TextChannel | VoiceChannel) {
        // fetch the entry of the clan that owned the deleted channel
        const cache = clanCache.getByValue(
            (value, key) =>
                key.startsWith(guildId) && 
                (value.textchannel === channel.id || value.voicechannel === channel.id)
        );
        let channelType = "";
        if(channel instanceof VoiceChannel) {
            channelType = "voicechannel";
            if(cache && cache[0]) cache[0].voicechannel = null;
        } else if(channel instanceof TextChannel) {
            channelType = "textchannel";
            if(cache && cache[0]) cache[0].textchannel = null;
        }

        if(channelType) {
            // if the channel deleted was of text or voice type
            if(cache && cache[0]) clanCache.set(`${guildId}:${cache[0].owner}`, cache[0]);
            await database.query(`DELETE FROM clan WHERE guild=$1 AND ${channelType}=$2`, [ guildId, channel.id ]);
        }
    }

    /**
     * Handle the event of a clan owned role being deleted.
     * 
     * Clans can not exist without their roles, so this will erase the clan.
     */
    async onAnyClanRoleDelete(guildId: Snowflake, role: Role) {
        const cache = clanCache.getByValue(
            (value, key) =>
                key.startsWith(guildId) &&
                (value.ownerrole === role.id || value.clanrole === role.id)
        );

        if(cache && cache[0]) clanCache.delete(`${guildId}:${cache[0].owner}`);
        await database.query(`DELETE FROM clan WHERE guild=$1 AND (ownerrole=$2 OR clanrole=$2)`, [ guildId, role.id ]);
        
    }
}

const ClanRepo = new ClanRepository();
export default ClanRepo;