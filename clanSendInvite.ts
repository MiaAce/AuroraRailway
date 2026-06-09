import { Snowflake } from "discord.js";
import database from "../Config/database.js";
import { SelfCache } from "../Config/SelfCache.js";
import { KofiIntegrationTable, KofiTier, KofiTierTable } from "../Interfaces/database_types";

const kofiTierCache = new SelfCache<string, KofiTierTable[]>(24 * 60 * 60_000); // 1 day
const kofiIntegrationCache = new SelfCache<string, string>(24 * 60 * 60_000); // guild snowflake acts as key and announcement channel snowflake acts as value

class KofiIntegrationRepository {
    /**
     * Initialize or update the announcement channel for the guild
     * @returns The row
     */
    async insertIntegration(guildId: Snowflake, channelId: Snowflake): Promise<KofiIntegrationTable> {
        const { rows: data } = await database.query<KofiIntegrationTable>(
            `INSERT INTO kofiintegration (guild, announcement_channel)
            VALUES ($1, $2)
            ON CONFLICT (guild)
            DO UPDATE SET
                announcement_channel = EXCLUDED.announcement_channel
                WHERE kofiintegration.announcement_channel IS DISTINCT FROM EXCLUDED.announcement_channel
                
            RETURNING *;`,
            [guildId, channelId]
        );
        kofiIntegrationCache.set(guildId, channelId);
        return data[0]!;
    }

    async deleteIntegration(guildId: Snowflake) {
        kofiIntegrationCache.delete(guildId);
        await database.query(`DELETE FROM kofiintegration WHERE guild=$1`, [guildId]);
    }

    async deleteIntegrationByChannel(channelId: Snowflake) {
        kofiIntegrationCache.deleteByValue((value) => value === channelId);
        await database.query(`DELETE FROM kofiintegration WHERE announcement_channel=$1`, [channelId]);
    }

    /**
     * @returns The guild kofi integration row or null if it doesn't exist
     */
    async getIntegration(guildId: Snowflake): Promise<KofiIntegrationTable | null> {
        const cache = kofiIntegrationCache.get(guildId);
        if (cache) return { guild: guildId, announcement_channel: cache };

        const { rows: data } = await database.query<KofiIntegrationTable>(
            `SELECT * FROM kofiintegration WHERE guild=$1`, [guildId]
        );

        if (data && data[0]) {
            kofiIntegrationCache.set(guildId, data[0].announcement_channel);
            return data[0];
        } else {
            return null;
        }
    }

    /**
     * If the tier already exist, the role column will be updated on conflict
     * 
     * @param kofiTier The tier to be added
     * @returns The new row
     */
    async putTier(kofiTier: KofiTier): Promise<KofiTierTable> {
        const { rows: data } = await database.query<KofiTierTable>(
            `INSERT INTO kofitier(integration, tier, role)
            VALUES($1, $2, $3)
            ON CONFLICT (integration, tier)
            DO UPDATE SET role = EXCLUDED.role
            RETURNING *;`,
            [kofiTier.integration, kofiTier.tier, kofiTier.role]
        );

        const cache = kofiTierCache.get(data[0]!.integration);
        if (cache) { // make sure there are no duplicates if the query goes on the conflict branch
            const existingIndex = cache.findIndex(c => c.tier === data[0]!.tier);
            if (existingIndex !== -1) {
                cache[existingIndex] = data[0]!;
            } else {
                cache.push(data[0]!);
            }
        } else {
            kofiTierCache.set(data[0]!.integration, data); // initialize cache
        }

        return data[0]!;
    }

    /**
     * @returns Whether a role is in use by the guild 
     */
    async isRoleInUse(guildId: Snowflake, roleId: Snowflake): Promise<boolean> {
        const cache = kofiTierCache.get(guildId);
        if (cache) {
            return cache.some(c => c.role === roleId);
        }

        const { rows: data } = await database.query<KofiTierTable>(
            `SELECT 1 FROM kofitier WHERE integration=$1 AND role=$2`,
            [guildId, roleId]
        );

        if (data && data[0]) {
            kofiTierCache.set(guildId, data);
            return true;
        } else {
            return false;
        }
    }

    /**
     * 
     * @returns All tiers from this guild 
     */
    async getTiers(guildId: Snowflake): Promise<KofiTierTable[]> {
        const cache = kofiTierCache.get(guildId);
        if (cache) return cache;

        const { rows: data } = await database.query<KofiTierTable>(
            `SELECT * FROM kofitier WHERE integration=$1`, [guildId]
        );

        kofiTierCache.set(guildId, data);
        return data;
    }

    async deleteTierByIdBulk(ids: number[]) {
        kofiTierCache.deleteByValue((value) => value.some(v => ids.includes(v.id)));
        await database.query(`DELETE FROM kofitier WHERE id=ANY($1::int[])`, [ids]);
    }

    async deleteTierByRole(roleId: Snowflake) {
        kofiTierCache.deleteByValue((value) => value.some(v => v.role === roleId));
        await database.query(`DELETE FROM kofitier WHERE role=$1`, [roleId]);
    }
}

const KofiIntegrationRepo = new KofiIntegrationRepository();
export default KofiIntegrationRepo;