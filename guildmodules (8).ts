import database from "../Config/database.js";

export default async function KofiIntegration(): Promise<void> {
    try {
        await database.query(
            `CREATE TABLE IF NOT EXISTS kofiintegration (
                guild BIGINT PRIMARY KEY,
                announcement_channel BIGINT NOT NULL
            );`
        );

        await database.query(
            `CREATE TABLE IF NOT EXISTS kofitier(
                id SERIAL PRIMARY KEY,
                integration BIGINT NOT NULL
                    REFERENCES kofiintegration(guild) ON DELETE CASCADE,
                tier TEXT NOT NULL,
                role BIGINT NOT NULL,

                UNIQUE (integration, tier),
                UNIQUE (integration, role)
            );`
        );

        // once the embed_constructor is implemented, kofiintegration can accept custom announcements
    } catch (error) {
        console.error(error);
        throw error;
    }
}