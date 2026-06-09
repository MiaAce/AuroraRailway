import {
    Client,
    Collection,
    Events,
    GatewayIntentBits,
    REST,
    Routes,
    type ChatInputCommandInteraction,
} from 'discord.js';
import { loadCommands } from './commandLoader.js';
import type { ChatCommand } from './types/command.js';

// ── Environment ──────────────────────────────────────────────────────────────

const token = process.env['BOT_TOKEN'];
const clientId = process.env['CLIENT_ID'];
const guildId = process.env['GUILD_ID']; // optional — set to register guild commands

if (!token) {
    console.error('Missing required environment variable: BOT_TOKEN');
    process.exit(1);
}

if (!clientId) {
    console.error('Missing required environment variable: CLIENT_ID');
    process.exit(1);
}

// ── Client setup ─────────────────────────────────────────────────────────────

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
    ],
});

// Attach a commands Collection to the client for fast lookup at interaction time
(client as Client & { commands: Collection<string, ChatCommand> }).commands =
    new Collection<string, ChatCommand>();

// ── Command registration helper ───────────────────────────────────────────────

async function registerCommands(commands: Collection<string, ChatCommand>): Promise<void> {
    const rest = new REST().setToken(token!);

    const globalCommands = commands
        .filter((cmd) => cmd.metadata.scope === 'global')
        .map((cmd) => cmd.data);

    const guildCommands = commands
        .filter((cmd) => cmd.metadata.scope === 'guild')
        .map((cmd) => cmd.data);

    try {
        if (globalCommands.length > 0) {
            console.log(`[Commands] Registering ${globalCommands.length} global command(s)…`);
            await rest.put(Routes.applicationCommands(clientId!), {
                body: globalCommands,
            });
            console.log(`[Commands] ${globalCommands.length} global command(s) registered.`);
        }

        if (guildCommands.length > 0 && guildId) {
            console.log(
                `[Commands] Registering ${guildCommands.length} guild command(s) for guild ${guildId}…`
            );
            await rest.put(Routes.applicationGuildCommands(clientId!, guildId), {
                body: guildCommands,
            });
            console.log(`[Commands] ${guildCommands.length} guild command(s) registered.`);
        } else if (guildCommands.length > 0 && !guildId) {
            console.warn(
                `[Commands] ${guildCommands.length} guild-scoped command(s) found but GUILD_ID is not set — skipping guild registration.`
            );
        }
    } catch (error) {
        console.error('[Commands] Failed to register commands with Discord:', error);
    }
}

// ── Ready event ───────────────────────────────────────────────────────────────

client.once(Events.ClientReady, async (readyClient) => {
    console.log(`AuroraRailway is online and logged in as ${readyClient.user.tag}`);

    // Load all commands from the commands/ directory
    const commands = await loadCommands();

    // Store on client for interaction lookup
    const typedClient = client as Client & { commands: Collection<string, ChatCommand> };
    for (const [name, command] of commands) {
        typedClient.commands.set(name, command);
    }

    // Register with Discord via REST
    await registerCommands(commands);
});

// ── Interaction handler ───────────────────────────────────────────────────────

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const typedClient = client as Client & { commands: Collection<string, ChatCommand> };
    const command = typedClient.commands.get(interaction.commandName);

    if (!command) {
        console.warn(`[Interactions] Unknown command received: ${interaction.commandName}`);
        return;
    }

    try {
        await command.execute(interaction as ChatInputCommandInteraction, client);
    } catch (error) {
        console.error(
            `[Interactions] Error executing command "${interaction.commandName}":`,
            error
        );

        const errorMessage = {
            content: 'An error occurred while executing this command.',
            ephemeral: true,
        };

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ ...errorMessage, flags: 64 });
            } else {
                await interaction.reply({ ...errorMessage, flags: 64 });
            }
        } catch {
            // Interaction may have already expired — nothing we can do
        }
    }
});

// ── Error handling ────────────────────────────────────────────────────────────

client.on(Events.Error, (error) => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully…');
    client.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully…');
    client.destroy();
    process.exit(0);
});

// ── Login ─────────────────────────────────────────────────────────────────────

client.login(token);
