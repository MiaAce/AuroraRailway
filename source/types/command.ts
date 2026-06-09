import type {
    ChatInputCommandInteraction,
    Client,
    PermissionResolvable,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';

export type CommandScope = 'global' | 'guild';

export interface CommandMetadata {
    /** Cooldown in seconds between uses */
    cooldown: number;
    /** Permissions the bot needs to execute this command */
    botPermissions: PermissionResolvable[];
    /** Permissions the user needs to use this command */
    userPermissions: PermissionResolvable[];
    /** Whether the command is registered globally or per-guild */
    scope: CommandScope;
    /** Category label for display purposes */
    category: string;
    /** Group name used for guild module enable/disable */
    group: string;
    /** If true, the command is skipped during loading */
    disabled?: boolean;
}

export interface ChatCommand {
    /** Slash command definition (SlashCommandBuilder.toJSON()) */
    data: RESTPostAPIChatInputApplicationCommandsJSONBody;
    /** Handler called when the slash command is invoked */
    execute(interaction: ChatInputCommandInteraction, client?: Client): Promise<void | boolean>;
    /** Metadata controlling registration and permissions */
    metadata: CommandMetadata;
}
