// Interfaces and types to respect the database tables

import type { Snowflake } from "discord.js"

export interface GuildTable {
    id?: number,
    guild: Snowflake
}

export interface GuildChannelTable extends GuildTable {
    channel: Snowflake
}

export interface GuildRolePair {
    guild: Snowflake,
    role: Snowflake
}

export type GuildMessageTable =
    | (GuildChannelTable & { messageid: Snowflake })
    | (GuildChannelTable & { message: Snowflake })

export type GuildChannelWithType =
    | (GuildChannelTable & { channeltype: string })
    | (GuildChannelTable & { type: string })
    | (GuildChannelTable & { eventtype: string })

export interface ColumnValuePair {
    column: string,
    value: unknown
}

export interface BotConfig {
    id: number,
    application_scope: string,
    backup_db_schedule: string | null
}

export type DbCacheKey = string;

export interface GuildModules {
    guild: Snowflake,
    disabled_groups: string[]
}

export interface GuildPlanTable {
    guild: Snowflake,
    plan: "free" | "premium",
    planSince: string,
    expiresAt: string | null
}

export interface AutoVoiceSystem extends GuildTable {
    category: Snowflake,
    managerchannel: Snowflake,
    autovoice: Snowflake,
    message: Snowflake
}

export interface AutoVoiceRoom extends GuildChannelTable {
    owner: Snowflake,
    timestamp: Snowflake,
    order_room: number
}

export interface ServerRoles extends GuildTable {
    roletype: string,
    role: Snowflake
}

export const GUILD_ROLE_TYPE = [
    "staff",
    "premium",
    "bot"
] as const;

export type GuildRoleTypeString = typeof GUILD_ROLE_TYPE[number];

export interface BlockSystem extends GuildTable {
    blocker: Snowflake,
    blocked: Snowflake
}

export interface ClanSystem extends GuildTable {
    category: Snowflake
}

export interface ClanTable extends GuildTable {
    owner: Snowflake,
    clanname: string,
    ownerrole: Snowflake,
    clanrole: Snowflake,
    voicechannel: Snowflake | null,
    textchannel: Snowflake | null
}

export const EVENT_GUILD_LOGS = [
    "moderation",
    "voice",
    "messages",
    "user-activity",
    "server-activity",
    "flagged-messages",
    "premium-activity",
    "justice-logs",
    "lfg-logs",
    "ticket-support"
] as const;

export interface KofiIntegrationTable {
    guild: string,
    announcement_channel: string
}

export interface KofiTier {
    integration: string,
    tier: string,
    role: string
}

export interface KofiTierTable extends KofiTier {
    id: number
}

export type EventGuildLogsString = typeof EVENT_GUILD_LOGS[number];