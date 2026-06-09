import {
    CategoryChannel,
    ChannelType,
    EmbedBuilder,
    Guild,
    GuildMember,
    MessageFlags,
    PermissionFlagsBits,
    Role,
    SlashCommandBuilder,
    TextChannel,
    VoiceChannel
} from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import {
    fetchGuildCategory,
    fetchGuildMember,
    fetchPremiumRole
} from "../../utility_modules/discord_helpers.js";
import ClanSystemRepo from "../../Repositories/clansystem.js";
import ServerRolesRepo from "../../Repositories/serverroles.js";
import ClanRepo from "../../Repositories/clan.js";
import { clanObjectBuilder } from "../../Systems/clan/clanGuildBuilder.js";
import { ClanObject } from "../../Interfaces/helper_types.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { ClanTable } from "../../Interfaces/database_types.js";

const clanAdmin: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("clan-admin")
        .setDescription("Administrative commands for the clan system.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set the category for the clan channels')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The category for supporter channels')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildCategory)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('clear')
                .setDescription('Clear the current setup and clans.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('info')
                .setDescription('Info about the clain setup')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('delete-clan')
                .setDescription('Delete the clan of the targeted owner.')
                .addUserOption(option =>
                    option.setName('member')
                        .setDescription('The owner of the clan to be removed.')
                        .setRequired(true)
                )
        )
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName('assign')
                .setDescription('Assign clan roles and clan channels to a premium member.')
                .addSubcommand(subcommand =>
                    subcommand.setName('roles')
                        .setDescription('Assign the associated clan roles to a supporter')
                        .addUserOption(option =>
                            option.setName('member')
                                .setDescription('The targeted premium member to become the owner of the clan')
                                .setRequired(true)
                        )
                        .addRoleOption(option =>
                            option.setName('ownerrole')
                                .setDescription('The owner role of the clan.')
                                .setRequired(true)
                        )
                        .addRoleOption(option =>
                            option.setName('clanrole')
                                .setDescription('The clan role of the clan')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('channels')
                        .setDescription('Assign channels to the targeted clan owner.')
                        .addUserOption(option =>
                            option.setName('member')
                                .setDescription('The clan owner.')
                                .setRequired(true)
                        )
                        .addChannelOption(option =>
                            option.setName('text-channel')
                                .setDescription('The text channel to be assigned')
                                .addChannelTypes(ChannelType.GuildText)
                        )
                        .addChannelOption(option =>
                            option.setName('voice-channel')
                                .setDescription('The voice channel to be assigned.')
                                .addChannelTypes(ChannelType.GuildVoice)
                        )
                )
        )
        .toJSON(),

    async execute(interaction, client) {
        const guild: Guild = interaction.guild as Guild;
        const options = interaction.options;

        const botMember: GuildMember = await guild.members.fetchMe();
        const subcommand = options.getSubcommand();
        const user = options.getUser('member');

        let member: GuildMember | null = null;
        // fetching the premium role and clan category
        const clanCategoryId = await ClanSystemRepo.getCategory(guild.id);
        const premiumRole = await fetchPremiumRole(client, guild);

        if (premiumRole === null) { // this command can not be ran without the guild setting a premium role
            // failure to fetch the role means the database has invalid entires
            await ServerRolesRepo.deleteGuildRole(guild.id, "premium");
            await interaction.reply({
                embeds: [
                    embed_error(
                        "The clan system configuration was deleted as it was invalid, set it up again.",
                        "Failed to fetch the premium role"
                    )
                ]
            });
            return;
        }

        if (user) {
            if (user.bot) {
                await interaction.reply({
                    embeds: [embed_error('Bots can not be targeted by this command!')],
                    flags: MessageFlags.Ephemeral
                });

                return false;
            }

            member = await fetchGuildMember(guild, user.id) as GuildMember;
            if (!member.roles.cache.has(premiumRole.id)) {
                await interaction.reply({
                    embeds: [embed_error("Only premium members can be targeted!", "Member lacks the premium role")],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
        }



        if (!clanCategoryId && (subcommand === 'roles' || subcommand === 'channels' || subcommand === 'delete-clan')) {
            await interaction.reply({
                embeds: [
                    embed_error('Use `/clan-admin set` first to assign the category.')
                ],
                flags: MessageFlags.Ephemeral
            });

            return false;
        }

        switch (subcommand) {
            case "set": {
                const category: CategoryChannel = options.getChannel('channel', true);

                // register input
                await ClanSystemRepo.setCategory(guild.id, category.id);

                await interaction.reply({
                    embeds: [
                        embed_message(
                            "Green",
                            `The clan system was set up successfully using ${category} as category.`
                        )
                    ],
                    flags: MessageFlags.Ephemeral
                });

                break;
            }
            case 'clear': {
                await ClanSystemRepo.delete(guild.id);
                await interaction.reply({
                    embeds: [embed_message("Green", 'The clan system configuration was cleared.')],
                    flags: MessageFlags.Ephemeral
                });
                break;
            }
            case 'info': {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                if (clanCategoryId === null) {
                    await interaction.editReply({
                        embeds: [
                            embed_message(
                                "Aqua",
                                `There is no clan system configuration in place for **${guild.name}**, use \`/clan-admin set\` first`
                            )
                        ]
                    });
                    return;
                }

                const clanCount = await ClanRepo.guildClansCount(guild.id);

                const clanCategory = await fetchGuildCategory(guild, clanCategoryId);
                if (!clanCategory) {
                    await interaction.editReply({
                        embeds: [
                            embed_error(
                                'Failed to fetch supporters category from database, might be a faulty row.\nThe row will be cleared.'
                            )
                        ]
                    });
                    await ClanSystemRepo.delete(guild.id);
                    return;
                }

                await interaction.editReply({
                    embeds: [
                        embed_message("Aqua", 'Current clan system configuration')
                            .setAuthor({
                                name: `${guild.name} clan system`,
                                iconURL: guild.iconURL({ extension: 'png' }) ?? ''
                            })
                            .addFields(
                                {
                                    name: 'Category',
                                    value: `${clanCategory}`,
                                    inline: true
                                },
                                {
                                    name: 'Total clans',
                                    value: `${clanCount}`
                                }
                            )
                    ]
                });

                break;
            }
            case 'delete-clan': {
                if (!member) {
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [
                            embed_error('Failed to fetch the member provided...')
                        ]
                    });
                    return;
                }

                const clanTable = await ClanRepo.getByOwner(guild.id, member.id);
                if (!clanTable) {
                    await interaction.reply({
                        embeds: [
                            embed_error("The member provided is not a clan owner!")
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const clanObj: ClanObject | null = await clanObjectBuilder(guild, clanTable);

                if (!clanObj || clanObj.owner.id != member.id) {
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [
                            embed_error(`There is no clan ownership associated with ${member}`)
                        ]
                    });
                    return;
                }

                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                // delete the clan and all the features
                try {
                    await clanObj.ownerRole.delete();
                    await clanObj.clanRole.delete();
                    if (clanObj.voice) await clanObj.voice.delete();
                    if (clanObj.textChannel) await clanObj.textChannel.delete();
                } catch (error) {
                    if (error instanceof Error) {
                        await errorLogHandle(error);
                    } else {
                        console.error('Unexpected error', error);
                    }

                    await interaction.editReply({
                        embeds: [
                            embed_error('An error occured, some roles or channels might have not been deleted...')
                        ]
                    });

                    return;
                }

                await ClanRepo.deleteByOwner(guild.id, member.id);

                await interaction.editReply({
                    embeds: [
                        embed_message("Green", `**${clanObj.clanname}** clan was successfully deleted and its features removed.`)
                    ]
                });
                break;
            }
            case 'roles': {
                if (!clanCategoryId) {
                    await interaction.reply({
                        embeds: [
                            embed_error('Use `/clan-admin set` first to assign the supporter role and category.')
                        ],
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                if (!member) {
                    await interaction.reply({
                        embeds: [
                            embed_error('Invalid user ID')
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const fetchMemberClan = await ClanRepo.getByOwner(guild.id, member.id);
                if (fetchMemberClan) {
                    // the member already owns a clan
                    await interaction.reply({
                        embeds: [
                            embed_error(
                                `Can not assign clan roles to ${member} since the member already owns the clan **${fetchMemberClan.clanname}**`
                            )
                        ]
                    });
                    return;
                }

                const ownerRole = options.getRole('ownerrole', true) as Role;
                const clanRole = options.getRole('clanrole', true) as Role;

                if (ownerRole.id === clanRole.id) {
                    await interaction.reply({
                        embeds: [
                            embed_error('Owner role and Clan role can not be the same!')
                        ],
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                if (ownerRole.managed || clanRole.managed) {
                    await interaction.reply({
                        embeds: [
                            embed_error('Bot managed roles can not be assigned for this!')
                        ],
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                if (
                    ownerRole.position >= botMember.roles.highest.position ||
                    clanRole.position >= botMember.roles.highest.position
                ) {
                    await interaction.reply({
                        embeds: [
                            embed_error("I lack permission to use one of the roles!\nRole's position is too high.")
                        ],
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                if (ownerRole.id === guild.roles.everyone.id || clanRole.id === guild.roles.everyone.id) {
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [
                            embed_error('@Everyone role is untargetable!')
                        ]
                    });

                    return;
                }

                if (
                    (await ClanRepo.isRoleInUse(guild.id, ownerRole.id)) ||
                    (await ClanRepo.isRoleInUse(guild.id, clanRole.id))
                ) {
                    await interaction.reply({
                        embeds: [
                            embed_error("One of the roles provided is already in use by another clan!")
                        ],
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                try { // make sure the clan owner has owner role assigned
                    await member.roles.add(ownerRole);
                } catch (error) {
                    if (error instanceof Error) {
                        await errorLogHandle(error);
                    } else {
                        console.error('Unexpected error: ' + error);
                    }
                }

                // register the change in db
                const clanTable: ClanTable = {
                    guild: guild.id,
                    owner: member.id,
                    clanname: ownerRole.name,
                    ownerrole: ownerRole.id,
                    clanrole: clanRole.id,
                    voicechannel: null,
                    textchannel: null
                };

                await ClanRepo.registerClan(clanTable);

                await interaction.editReply({
                    embeds: [
                        embed_message("Green",
                            `${member} has been assigned as the clan owner of ${ownerRole}`
                        )
                    ]
                });
                break;
            }
            case 'channels': {
                if (!clanCategoryId) {
                    await interaction.reply({
                        embeds: [
                            embed_error('Use `/clan-admin set` first to assign the supporter role and category.')
                        ],
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                if (!member) {
                    await interaction.reply({
                        embeds: [
                            embed_error('Invalid user ID')
                        ],
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                const fetchClan = await ClanRepo.getByOwner(guild.id, member.id);

                if (!fetchClan) {
                    await interaction.reply({
                        embeds: [
                            embed_error(
                                "You can assign clan channels only to clan owners!\nUse `/clan-admin assign roles` to assign a clan to this member."
                            )
                        ],
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                const textchannel: TextChannel | null = options.getChannel('text-channel');
                const voicechannel: VoiceChannel | null = options.getChannel('voice-channel');

                if (textchannel === null && voicechannel === null) {
                    // one value can remain null but not both

                    await interaction.reply({
                        embeds: [
                            embed_error('At least one channel type must be assigned to a guild channel.')],
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                const clanCategory = await fetchGuildCategory(guild, clanCategoryId);
                if (clanCategory === null) {
                    await interaction.reply({
                        embeds: [
                            embed_error('Database faulty row, the category id for clan system is invalid and will be cleared')
                                .setTitle('Failure to fetch')
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                    await ClanSystemRepo.delete(guild.id);
                    return;
                }

                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const embed: EmbedBuilder = embed_message("Green", 'Channels assigned successfully');
                if (textchannel) {
                    if (!textchannel.parent || textchannel.parent.id != clanCategory.id) {
                        // if the channel is not a child of the clan category
                        await interaction.editReply({
                            embeds: [
                                embed_error('The text channel given is not under the clan category.')
                            ]
                        });
                        return;
                    }

                    const isInUse = await ClanRepo.isChannelInUse(guild.id, textchannel.id);
                    if(isInUse) {
                        await interaction.editReply({
                            embeds: [
                                embed_error("This text channel is already owned by another clan.")
                            ]
                        });
                        return;
                    }

                    // register channel
                    await ClanRepo.setTextChannel(guild.id, member.id, textchannel.id);
                    embed.addFields({
                        name: 'Text Channel',
                        value: `${textchannel}`
                    });
                }
                if (voicechannel) {
                    if (!voicechannel.parent || voicechannel.parent.id != clanCategory.id) {
                        await interaction.editReply({
                            embeds: [
                                embed_error('The voice channel given is not under the clan category.')
                            ]
                        });
                        return;
                    }

                    const isInUse = await ClanRepo.isChannelInUse(guild.id, voicechannel.id);
                    if(isInUse) {
                        await interaction.editReply({
                            embeds: [
                                embed_error("This voice channel is already owned by another clan.")
                            ]
                        });
                        return;
                    }

                    // register channel
                    await ClanRepo.setVoiceChannel(guild.id, member.id, voicechannel.id);
                    embed.addFields({
                        name: 'Voice channel',
                        value: `${voicechannel}`
                    });
                }
                await interaction.editReply({ embeds: [embed] });
                break;
            }
        }
    },
    metadata: {
        cooldown: 10,
        userPermissions: [PermissionFlagsBits.Administrator],
        botPermissions: [
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ViewAuditLog
        ],
        scope: "guild",
        category: "Administrator",
        group: "clan",

    }
}

export default clanAdmin;