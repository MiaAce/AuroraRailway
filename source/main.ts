import { Client, GatewayIntentBits, Events } from 'discord.js';

const token = process.env['BOT_TOKEN'];

if (!token) {
    console.error('Missing required environment variable: BOT_TOKEN');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
    ],
});

client.once(Events.ClientReady, (readyClient) => {
    console.log(`AuroraRailway is online and logged in as ${readyClient.user.tag}`);
});

client.on(Events.Error, (error) => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

client.login(token);
