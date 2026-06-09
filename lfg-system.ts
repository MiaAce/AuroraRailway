import { CategoryChannel, ChannelType, GuildMember, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, TextChannel, VoiceChannel } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import AutoVoiceRoomRepo from "../../Repositories/autovoiceroom.js";

const channelCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("channel")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription("Manage channels.")
        .addSubcommand(subcommand =>
            subcommand.setName("delete")
                .setDescription("Delete a channel.")
                .addChannelOption(option =>
                    option.setName("channel")
                        .setDescription("The channel to be deleted")
                        .setRequired(true)
                        .addChannelTypes(
                            ChannelType.GuildText,
                            ChannelType.GuildVoice,
                            ChannelType.GuildCategory
                        )
                )
        )
        .toJSON(),
    metadata: {
        cooldown: 10,
        userPermissions: [PermissionFlagsBits.Administrator],
        botPermissions: [PermissionFlagsBits.ManageChannels],
        group: "global",
        category: "Administrator",
        scope: "global",
        ownerOnly: true
    },
    async execute(interaction) {
        const admin = interaction.member as GuildMember;
        const guild = admin.guild;
        const options = interaction.options;
        const subcommand = options.getSubcommand();

        switch (subcommand) {
            case "delete": {
                const channel = options.getChannel("channel", true) as TextChannel | CategoryChannel | VoiceChannel;
                try {
                    await channel.delete();
                    // might be a voice channel
                    await AutoVoiceRoomRepo.deleteRoom(guild.id, channel.id);
                    await interaction.reply({
                        embeds: [embed_message("Green", "Channel deleted.")],
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    await interaction.reply({
                        embeds: [embed_error(`Couldn't delete ${channel}.`)],
                        flags: MessageFlags.Ephemeral
                    });
                    console.error(error);
                }
                break;
            }
        }
    }
}

export default channelCommand;