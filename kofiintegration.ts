import { Client, ChatInputCommandInteraction } from "discord.js";
import type { PermissionResolvable, RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js";

/**
 * The interface for slash commands
 * 
 * @param data SlashCommandBuilder.toJSON() object
 * @param metadata Metadata about the command such as permissions required, cooldown, scope, etc
 * @param execute The async method called by interactionCreate when the command is used
 */
export interface ChatCommand {
    data: RESTPostAPIChatInputApplicationCommandsJSONBody,
    metadata: ChatCommandMetadata,
    execute: (interaction: ChatInputCommandInteraction, client: Client) => Promise<unknown>,
}

export interface ChatCommandMetadata {
    botPermissions: PermissionResolvable[],
    userPermissions: PermissionResolvable[],
    cooldown: number,
    scope: "global" | "guild",
    group?: ChatCommandGroup,
    category?: ChatCommandCategory,
    ownerOnly?: boolean,
    testOnly?: boolean,
    disabled?: boolean
}

export type ChatCommandGroup =
    | "global"
    | "autovoice"
    | "premium"
    | "block"
    | "clan"
    | "lfg"

export type ChatCommandCategory = 
    | "Info"
    | "Administrator"
    | "Owner"
    | "Social"
    | "Staff"
    | "Moderator"
    | "Game"
    | "Miscellaneous"
    | "Premium"