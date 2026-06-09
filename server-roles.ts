import {
    ActionRowBuilder,
    APISelectMenuOption,
    ChannelType,
    ComponentType,
    EmbedBuilder,
    Guild,
    GuildMember,
    MessageFlags,
    PermissionFlagsBits,
    RestOrArray,
    Role,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    TextChannel
} from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import KofiIntegrationRepo from "../../Repositories/kofiintegration.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { KofiTier, KofiTierTable } from "../../Interfaces/database_types.js";
import { fetchGuildChannel, fetchGuildRole, message_collector } from "../../utility_modules/discord_helpers.js";

const kofi: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("kofi")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription("Manage the ko-fi integration to announce the sponsors of this guild.")
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName("integration")
                .setDescription("Set or delete the integration for this guild.")
                .addSubcommand(subcommand =>
                    subcommand.setName("set")
                        .setDescription("Set the integration for this server.")
                        .addChannelOption(option =>
                            option.setName("announcement-channel")
                                .setDescription("The channel where ko-fi members are announced.")
                                .addChannelTypes(ChannelType.GuildText)
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("delete")
                        .setDescription("Delete the current integration, stopping the announcements.")
                )
        )
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName("tier")
                .setDescription("Upsert or delete ko-fi tiers.")
                .addSubcommand(subcommand =>
                    subcommand.setName("upsert")
                        .setDescription("Insert or update an existing ko-fi tier.")
                        .addStringOption(option =>
                            option.setName("tier")
                                .setDescription("The name of the tier.")
                                .setMinLength(3)
                                .setMaxLength(25)
                                .setRequired(true)
                        )
                        .addRoleOption(option =>
                            option.setName("role")
                                .setDescription("The role that corresponds to the given tier.")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("delete")
                        .setDescription("Delete the selected tier.")
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("list")
                .setDescription("List the current configuration and member count for each tier role.")
        )
        .toJSON(),
    metadata: {
        cooldown: 10,
        scope: "guild",
        category: "Administrator",
        group: "premium",
        userPermissions: [PermissionFlagsBits.Administrator],
        botPermissions: [
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels
        ]
    },
    async execute(interaction) {
        const admin = interaction.member as GuildMember;
        const guild = interaction.guild as Guild;
        const botMember = await guild.members.fetchMe()
        const options = interaction.options;
        const subcommand = options.getSubcommand();
        const subcommandGroup = options.getSubcommandGroup()

        // fetch integration row
        const kofi = await KofiIntegrationRepo.getIntegration(guild.id);
        if (subcommandGroup !== "integration" || subcommand !== "set") {
            // the other subcommands require the integration row
            if (!kofi) {
                await interaction.reply({
                    embeds: [embed_message("Red", `This action require the integration subcommand first.\nUse \`/kofi integration\` .`)],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
        }

        const kofiTiers: KofiTierTable[] = await KofiIntegrationRepo.getTiers(guild.id)
        if (subcommand === "list" || (subcommandGroup === "tier" && subcommand === "delete")) {
            // list and tier delete require for there to be at least one tier
            if (kofiTiers.length === 0) {
                await interaction.reply({
                    embeds: [
                        embed_message("Red", `There are no tiers on this server to execute this action.\nUse \`/kofi tier upsert\` first.`)
                    ],
                    flags: MessageFlags.Ephemeral
                });

                return;
            }
        }

        if (subcommand === "list") {
            // the list subcommand
            const embed = new EmbedBuilder()
                .setColor("Purple")
                .setAuthor({
                    name: `${guild.name} Ko-fi integration`,
                    iconURL: `${guild.iconURL({ extension: "png" })}`
                });

            const announcementChannel = await fetchGuildChannel(guild, kofi!.announcement_channel);
            if (!(announcementChannel instanceof TextChannel)) {
                await interaction.reply({
                    embeds: [embed_error("Failed to fetch the announcement channel for ko-fi integration...")],
                    flags: MessageFlags.Ephemeral
                });

                // clean faulty row
                await KofiIntegrationRepo.deleteIntegration(guild.id);
                return;
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            embed.setDescription(`Announcement channel: ${announcementChannel}`);

            for (const tier of kofiTiers) {
                const role = await fetchGuildRole(guild, tier.role);
                if (role === null) {
                    // clean faulty row and skip
                    await KofiIntegrationRepo.deleteTierByRole(tier.role);
                    continue;
                }

                embed.addFields({
                    name: `${tier.tier} - ${role.members.size}`,
                    value: `${role}`,
                    inline: true
                });
            }

            await interaction.editReply({ embeds: [embed] });

            return;
        }

        switch (subcommandGroup) {
            case "integration": {
                switch (subcommand) {
                    case "set": {
                        const channel = options.getChannel("announcement-channel", true);
                        await KofiIntegrationRepo.insertIntegration(guild.id, channel.id);
                        await interaction.reply({
                            embeds: [embed_message("Green", `The announcement channel is now set to ${channel}.`)],
                            flags: MessageFlags.Ephemeral
                        });
                        break;
                    }
                    case "delete": {
                        await KofiIntegrationRepo.deleteIntegration(guild.id);
                        await interaction.reply({
                            embeds: [embed_message("Green", "The integration for this server was wiped.")],
                            flags: MessageFlags.Ephemeral
                        });
                        break;
                    }
                }
                break;
            }
            case "tier": {
                switch (subcommand) {
                    case "upsert": {
                        const tier = options.getString("tier", true).toUpperCase();
                        const role = options.getRole("role", true) as Role;

                        if (
                            role.position >= admin.roles.highest.position
                            || role.position >= botMember.roles.highest.position
                            || role.managed
                            || role.id === guild.roles.everyone.id
                        ) {
                            await interaction.reply({
                                embeds: [
                                    embed_message("Red",
                                        "The role can NOT be one of the following: everyone role, above your highest role, " +
                                        "above my highest role or managed by a bot (bot role)."
                                    )
                                ],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        const isRoleInUse = await KofiIntegrationRepo.isRoleInUse(guild.id, role.id);
                        if (isRoleInUse) {
                            await interaction.reply({
                                embeds: [embed_message("Red", "This role is already in use by another tier.")]
                            });
                        }

                        const kofiTier: KofiTier = {
                            integration: guild.id,
                            tier: tier,
                            role: role.id
                        }

                        await KofiIntegrationRepo.putTier(kofiTier);
                        await interaction.reply({
                            embeds: [embed_message("Green", `Tier **${tier}** uses ${role}.`)],
                            flags: MessageFlags.Ephemeral
                        });
                        break;
                    }
                    case "delete": {
                        const selectTierOptions: RestOrArray<APISelectMenuOption> =
                            kofiTiers.map(tier => {
                                return {
                                    label: tier.tier,
                                    description: `Delete ${tier.tier}`,
                                    value: `${tier.id}`
                                }
                            });

                        const selectTierMenu = new StringSelectMenuBuilder()
                            .setCustomId("tier-select-menu")
                            .setMinValues(1)
                            .setMaxValues(kofiTiers.length > 10 ? 10 : kofiTiers.length) // limit to 10
                            .setPlaceholder("Tiers...")
                            .addOptions(selectTierOptions);
                        await interaction.reply({
                            embeds: [
                                embed_message("Purple", "Select the tiers you wish to delete.")
                            ],
                            components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectTierMenu)]
                        });

                        const reply = await interaction.fetchReply();
                        const collector = await message_collector<ComponentType.StringSelect>(
                            reply,
                            {
                                componentType: ComponentType.StringSelect,
                                time: 300_000,
                                filter: (i) => i.user.id === interaction.user.id
                            },
                            async (selectInteraction) => {
                                const ids = selectInteraction.values
                                    .map(v => Number(v))
                                    .filter(id => !Number.isNaN(id));
                                await KofiIntegrationRepo.deleteTierByIdBulk(ids);

                                await selectInteraction.reply({
                                    embeds: [embed_message("Green", "Deletion completed.")],
                                    flags: MessageFlags.Ephemeral
                                });

                                collector.stop();
                            },
                            async () => {
                                if (reply.deletable) {
                                    try {
                                        await reply.delete();
                                    } catch {/* do nothing */ }
                                }
                            }
                        )
                        break;
                    }
                }
                break;
            }

        }
    }
}

export default kofi;