import {
    ChatInputCommandInteraction,
    Client,
    EmbedBuilder,
    SlashCommandBuilder,
    version as djsVersion,
} from 'discord.js';
import type { ChatCommand } from '../types/command.js';

const botinfo: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Display information about the bot.')
        .toJSON(),

    async execute(interaction: ChatInputCommandInteraction, client?: Client) {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

        const memUsage = process.memoryUsage();
        const heapUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
        const heapTotalMB = (memUsage.heapTotal / 1024 / 1024).toFixed(2);

        const guildCount = client?.guilds.cache.size ?? 0;
        const userCount = client?.guilds.cache.reduce(
            (acc, guild) => acc + guild.memberCount,
            0
        ) ?? 0;

        const embed = new EmbedBuilder()
            .setColor('Blurple')
            .setTitle('Bot Information')
            .setThumbnail(client?.user?.displayAvatarURL() ?? null)
            .addFields(
                { name: '🤖 Bot', value: client?.user?.tag ?? 'Unknown', inline: true },
                { name: '🏓 Latency', value: `${client?.ws.ping ?? -1}ms`, inline: true },
                { name: '⏱️ Uptime', value: uptimeString, inline: true },
                { name: '🌐 Servers', value: `${guildCount}`, inline: true },
                { name: '👥 Users', value: `${userCount}`, inline: true },
                {
                    name: '💾 Memory',
                    value: `${heapUsedMB} MB / ${heapTotalMB} MB`,
                    inline: true,
                },
                { name: '📦 Discord.js', value: `v${djsVersion}`, inline: true },
                { name: '🟢 Node.js', value: process.version, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'AuroraRailway' });

        await interaction.reply({ embeds: [embed] });
    },

    metadata: {
        cooldown: 10,
        botPermissions: [],
        userPermissions: [],
        scope: 'global',
        category: 'Utility',
        group: 'global',
    },
};

export default botinfo;
