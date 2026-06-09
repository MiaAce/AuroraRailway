import {
	ButtonBuilder,
	ButtonStyle,
	TextInputBuilder,
	TextInputStyle,
	LabelBuilder,
	ModalBuilder,
	ButtonInteraction,
	CacheType,
	Message,
	Guild,
	MessageFlags,
	Role,
	GuildMember,
	ActionRowBuilder,
	CategoryChannel,
	EmbedBuilder,
	PermissionFlagsBits,
	ComponentType,
	Collection,
	TextChannel,
	ChannelType,
	Snowflake,
	ChatInputCommandInteraction
} from "discord.js";
import { ClanObject } from "../../Interfaces/helper_types.js";
import { fetchGuildCategory, fetchPremiumRole, hasBlockedContent, message_collector } from "../../utility_modules/discord_helpers.js";
import { clanEmbedBuilder, clanObjectBuilder, clanObjectToTable } from "./clanGuildBuilder.js";
import { ClanTable } from "../../Interfaces/database_types.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { hasCooldown } from "../../utility_modules/utility_methods.js";
import ClanRepo from "../../Repositories/clan.js";
import { local_config } from "../../objects/local_config.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import ClanSystemRepo from "../../Repositories/clansystem.js";


// buttons
export const createClan = new ButtonBuilder()
	.setCustomId('create-clan')
	.setLabel('Create Clan')
	.setStyle(ButtonStyle.Success);
export const modifyClan = new ButtonBuilder()
	.setCustomId('modify-clan')
	.setLabel('Modify Clan')
	.setStyle(ButtonStyle.Primary);
export const deleteClan = new ButtonBuilder()
	.setLabel('Delete Clan')
	.setCustomId('delete-clan')
	.setStyle(ButtonStyle.Danger);
export const confirmDelete = new ButtonBuilder()
	.setLabel('Confirm')
	.setStyle(ButtonStyle.Danger)
	.setCustomId('confirm-delete-button');
export const clanNameBtn = new ButtonBuilder()
	.setCustomId('clan-name-button')
	.setLabel('Clan Name')
	.setStyle(ButtonStyle.Primary);
export const roleColorBtn = new ButtonBuilder()
	.setCustomId('role-color-button')
	.setLabel('Role Color')
	.setStyle(ButtonStyle.Primary);
export const roleIconBtn = new ButtonBuilder()
	.setCustomId('role-icon-button')
	.setLabel('Role Icon')
	.setStyle(ButtonStyle.Primary);
export const textBtn = new ButtonBuilder()
	.setLabel('Text Channel')
	.setCustomId('text-channel-button')
	.setStyle(ButtonStyle.Primary);
export const voiceBtn = new ButtonBuilder()
	.setLabel('Voice Channel')
	.setCustomId('voice-channel-button')
	.setStyle(ButtonStyle.Primary);

// modals
const clanNameInput = new TextInputBuilder()
	.setCustomId('clan-name-input')
	.setRequired(true)
	.setPlaceholder('Clan name...')
	.setMinLength(1)
	.setMaxLength(100)
	.setStyle(TextInputStyle.Short);
const clanNameLabel = new LabelBuilder()
	.setLabel('Clan name')
	.setDescription('The name for your clan and clan roles.')
	.setTextInputComponent(clanNameInput);
export const clanNameModal = new ModalBuilder()
	.setCustomId('clan-name-modal')
	.setTitle('Clan name')
	.addLabelComponents(clanNameLabel);
const hexColorInput = new TextInputBuilder()
	.setCustomId('hex-color-input')
	.setRequired(true)
	.setPlaceholder('2596be')
	.setMinLength(6)
	.setMaxLength(6)
	.setStyle(TextInputStyle.Short);
const hexColorLabel = new LabelBuilder()
	.setLabel('Hexcolor code')
	.setDescription('The desired color as a hexcode')
	.setTextInputComponent(hexColorInput);
export const hexColorModal = new ModalBuilder()
	.setCustomId('hex-color-modal')
	.setTitle('Role color')
	.addLabelComponents(hexColorLabel);
const channelNameInput = new TextInputBuilder()
	.setCustomId('channel-name-input')
	.setRequired(true)
	.setPlaceholder('Channel name...')
	.setMinLength(1)
	.setMaxLength(50)
	.setStyle(TextInputStyle.Short);

const channelNameLabel = new LabelBuilder()
	.setLabel('Channel name')
	.setDescription('The name for your clan channel')
	.setTextInputComponent(channelNameInput);

export const channelNameModal = new ModalBuilder()
	.setCustomId('channel-name-modal')
	.setTitle('Channel Name')
	.addLabelComponents(channelNameLabel);


async function create_clan_button(interaction: ButtonInteraction<CacheType>, message: Message<boolean>) {
	const guild = interaction.guild as Guild;
	const client = guild.client;
	const clanTable = await ClanRepo.getByOwner(guild.id, interaction.user.id);
	if (clanTable) {
		return await interaction.reply({
			flags: MessageFlags.Ephemeral,
			embeds: [
				embed_error('You already own a clan!')
			]
		});
	}

	const premiumRole = await fetchPremiumRole(client, guild);

	if (!premiumRole) {
		return await interaction.reply({
			flags: MessageFlags.Ephemeral,
			embeds: [
				embed_error('The supporter role row is faulty, announce an administrator!')
			]
		});
	}

	await interaction.showModal(clanNameModal);

	try {
		const submit = await interaction.awaitModalSubmit({
			filter: i => i.user.id === interaction.user.id,
			time: 120_000
		});

		await submit.deferReply({ flags: MessageFlags.Ephemeral });

		const clanName = submit.fields.getTextInputValue('clan-name-input');

		const localTriggers = Object.values(local_config.rules.toxic_pattern).flat();
		const badName = await hasBlockedContent(clanName, localTriggers, guild);
		if (badName) {
			return await submit.editReply({
				embeds: [
					embed_error(`\`${clanName}\` triggered the filter. Please contact an admin if you believe it's a false positive.`, "Bad word usage")
				]
			});
		}

		const getClanByName = await ClanRepo.getByClanName(guild.id, clanName);
		if (getClanByName) {
			return await submit.editReply({
				embeds: [
					embed_error(`**${clanName}** is already in use, please try something different.`, "Name aleady in use")
				]
			});
		}

		const clanRole: Role = await guild.roles.create({
			name: clanName,
			position: 0
		});
		const ownerRole: Role = await guild.roles.create({
			name: clanName,
			position: premiumRole.position + 7 // TODO CHANGE THIS INTO A DEFAULT VALUE WITH THE OPTION INSIDE /clan-admin TO SET ANOTHER VALUE
		});

		const clanObject: ClanObject = {
			guild: guild,
			owner: interaction.member as GuildMember,
			clanname: clanName,
			ownerRole: ownerRole,
			clanRole: clanRole,
			voice: null,
			textChannel: null
		};

		try {
			await clanObject.owner.roles.add(clanObject.ownerRole);
		} catch (error) {
			if (error instanceof Error) {
				await errorLogHandle(error);
			} else {
				console.error('Unexpected error', error);
			}

			return await submit.editReply({
				embeds: [embed_error('The role was created, but assignation failed.')]
			});
		}

		const newClan: ClanTable = clanObjectToTable(clanObject);
		await ClanRepo.registerClan(newClan); // register in database

		createClan.setDisabled(true);
		modifyClan.setDisabled(false);
		deleteClan.setDisabled(false);

		await message.edit({
			embeds: [clanEmbedBuilder(clanObject)],
			components: [new ActionRowBuilder<ButtonBuilder>().addComponents(createClan, modifyClan, deleteClan)]
		});

		await submit.editReply({
			embeds: [embed_message("Green", 'Your clan has been created.')]
		});
	} catch (error) {
		console.error(error);
		// modal expiration
		await interaction.followUp({
			flags: MessageFlags.Ephemeral,
			embeds: [embed_message("Aqua", 'Time ran out for this modal.')]
		});
	}
}

async function modify_clan_button(interaction: ButtonInteraction, message: Message<boolean>) {
	if (!interaction.channel || !interaction.guild || !(interaction.member instanceof GuildMember)) return;

	const guild = interaction.guild;
	const owner = interaction.member;

	const clanCategoryId = await ClanSystemRepo.getCategory(guild.id);

	if (!clanCategoryId) {
		return await interaction.reply({
			flags: MessageFlags.Ephemeral,
			embeds: [embed_error('The clan system is missing.')]
		});
	}
	const clanCategory: CategoryChannel | null = await fetchGuildCategory(guild, clanCategoryId);
	if (!clanCategory) {
		await ClanSystemRepo.delete(guild.id); // fetching category failed, handle faulty row
		return await interaction.reply({
			embeds: [embed_error("Failed to fetch the clan system category...", "Fatal error")],
			flags: MessageFlags.Ephemeral
		});
	}

	const clanTable: ClanTable | null = await ClanRepo.getByOwner(guild.id, owner.id);
	if (!clanTable) {
		return await interaction.reply({
			flags: MessageFlags.Ephemeral,
			embeds: [embed_error("This is a bug, you shouldn't be able to do this without owning a clan!")]
		});
	}

	const clanObj: ClanObject | null = await clanObjectBuilder(guild, clanTable);
	if (!clanObj) {
		console.error("Failed to build the clan object using ClanTable:\n" + `${JSON.stringify(clanTable)}`);
		return await interaction.reply({
			flags: MessageFlags.Ephemeral,
			embeds: [embed_error("Fetching the clan object resulted in an error...")]
		});
	}

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const fetchedReply = await interaction.fetchReply();

	const firstRow = new ActionRowBuilder<ButtonBuilder>().addComponents(clanNameBtn, roleColorBtn, roleIconBtn);
	const secondRow = new ActionRowBuilder<ButtonBuilder>().addComponents(textBtn, voiceBtn);

	await interaction.editReply({
		embeds: [
			new EmbedBuilder().setColor('Purple').setTitle('Clan Manager').setFields(
				{
					name: 'Clan Name',
					value: 'Change role and clan name'
				},
				{
					name: 'Role Color',
					value: 'Set role color'
				},
				{
					name: 'Role Icon',
					value: 'Set role icon (max 256KB).'
				},
				{
					name: 'Text Channel',
					value: 'Create/modify clan text channel'
				},
				{
					name: 'Voice Channel',
					value: 'Create/modify clan voice channel'
				}
			)
		],
		components: [firstRow, secondRow]
	});

	const clanChannelPermissions = [
		{
			id: guild.roles.everyone.id,
			deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
		},
		{
			id: clanObj.ownerRole.id,
			allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel]
		},
		{
			id: clanObj.clanRole.id,
			allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel]
		}
	];

	const cooldowns = new Collection<string, number>();
	const cd = 10_000;
	const collector = await message_collector<ComponentType.Button>(fetchedReply,
		{
			componentType: ComponentType.Button,
			time: 600_000,
			filter: (i) => i.user.id === interaction.user.id
		},
		async (buttonInteraction) => {
			const clanToCheck = await ClanRepo.getByOwner(guild.id, owner.id);
			if (!clanToCheck) {
				// if the menu is open but the clan was deleted somehow
				await buttonInteraction.reply({
					flags: MessageFlags.Ephemeral,
					embeds: [embed_error('Invalid interaction, your clan was deleted while this menu was active!')]
				});

				collector.stop();
				return;
			}

			const userCooldown = hasCooldown(owner.id, cooldowns, cd);
			if (userCooldown) {
				const expirationTimestamp = Math.floor(userCooldown / 1000); // in seconds
				await buttonInteraction.reply({
					flags: MessageFlags.Ephemeral,
					embeds: [embed_error(`The buttons are on cooldown! <t:${expirationTimestamp}:R>`)]
				});
				return;
			}
			cooldowns.set(buttonInteraction.user.id, Date.now());
			setTimeout(() => cooldowns.delete(owner.id), cd);

			if (buttonInteraction.customId === 'clan-name-button') {
				await buttonInteraction.showModal(clanNameModal);
				try {
					const submit = await buttonInteraction.awaitModalSubmit({
						filter: i => i.user.id === owner.id,
						time: 120_000
					});

					const clanName = submit.fields.getTextInputValue("clan-name-input");

					const localTriggers = Object.values(local_config.rules.toxic_pattern).flat();
					const badName = await hasBlockedContent(clanName, localTriggers, guild);
					if (badName) {
						await submit.reply({
							embeds: [
								embed_error(`\`${clanName}\` triggered the filter. Please contact an admin if you believe it's a false positive.`, "Bad word usage")
							],
							flags: MessageFlags.Ephemeral
						});
						return;
					}

					const clanByName = await ClanRepo.getByClanName(guild.id, clanName);
					if (clanByName) {
						await submit.reply({
							embeds: [
								embed_error("This name is already in use, please try something else!", "Name already in use")
							],
							flags: MessageFlags.Ephemeral
						});
						return;
					}

					clanTable.clanname = clanName;
					clanObj.clanname = clanTable.clanname;

					await ClanRepo.updateByOwner(clanTable); // update name in database
					// update roles
					await clanObj.ownerRole.edit({
						name: clanTable.clanname
					});
					await clanObj.clanRole.edit({
						name: clanTable.clanname
					});

					try {
						await message.edit({
							embeds: [clanEmbedBuilder(clanObj)]
						});
					} catch (error) {
						if (error instanceof Error) {
							await errorLogHandle(error);
						} else {
							console.error(error);
						}
					}

					await submit.reply({
						flags: MessageFlags.Ephemeral,
						embeds: [embed_message("Green", `Clan name changed to **${clanObj.clanname}**.`)]
					});
				} catch {
					await buttonInteraction.followUp({
						flags: MessageFlags.Ephemeral,
						embeds: [embed_message("Red", 'Time ran out.')]
					});
				}
			} else if (buttonInteraction.customId === 'role-color-button') {
				// TODO: ADD THE ABILITY TO SET SPECIAL COLORS AND CHECK FOR SERVER BOOST LEVEL
				await buttonInteraction.showModal(hexColorModal);

				try {
					const submit = await buttonInteraction.awaitModalSubmit({
						filter: i => i.user.id === owner.id,
						time: 120_000
					});

					const hexcolor = '0x' + submit.fields.getTextInputValue('hex-color-input');
					const hexColorRegex = /^0x([A-Fa-f0-9]{6})$/;

					if (!hexColorRegex.test(hexcolor)) {
						await submit.reply({
							flags: MessageFlags.Ephemeral,
							embeds: [embed_error('Invalid input, a hexcolor should look like this: `2596be`.')]
						});
						return;
					}

					await clanObj.clanRole.edit({
						colors: {
							primaryColor: Number(hexcolor)
						}
					});
					await clanObj.ownerRole.edit({
						colors: {
							primaryColor: Number(hexcolor)
						}
					});

					try {
						await message.edit({
							embeds: [clanEmbedBuilder(clanObj)]
						});
					} catch {
						/* do nothing */
					}

					await submit.reply({
						flags: MessageFlags.Ephemeral,
						embeds: [embed_message("Green", `Color code changed to \`${hexcolor}\` - ${clanObj.ownerRole}`)]
					});
				} catch {
					await buttonInteraction.followUp({
						flags: MessageFlags.Ephemeral,
						embeds: [embed_message("Red", 'Time ran out')]
					});
				}
			} else if (buttonInteraction.customId === 'role-icon-button') {
				await buttonInteraction.reply({
					flags: MessageFlags.Ephemeral,
					embeds: [
						embed_message("Aqua",
							'Send the desired image icon in the current channel.\nFile size must be less than `256KB`!')
					]
				});

				const filterMessage = (msg: Message) => msg.author.id === owner.id; // accept only the user input
				const channel: TextChannel = interaction.channel as TextChannel;
				const messageCollector = channel.createMessageCollector({
					filter: filterMessage,
					max: 1,
					time: 60_000
				});

				messageCollector.on('collect', async msg => {
					// message must have the image icon attached

					if (msg.attachments.size === 0) {
						return await buttonInteraction.followUp({
							flags: MessageFlags.Ephemeral,
							embeds: [embed_message("Red", 'No image was provided, try again!')]
						});
					}

					const imageAttachment = msg.attachments.first();

					if (!imageAttachment?.contentType?.includes('image')) {
						return await buttonInteraction.followUp({
							flags: MessageFlags.Ephemeral,
							embeds: [embed_error('Invalid file format!')]
						});
					}

					if (imageAttachment.size > 256_000) {
						return await buttonInteraction.followUp({
							flags: MessageFlags.Ephemeral,
							embeds: [embed_error('The image is too large!\nUpload an image below `256KB`')]
						});
					}

					try {
						await clanObj.ownerRole.edit({
							icon: imageAttachment.url
						});
					} catch {
						return await buttonInteraction.followUp({
							flags: MessageFlags.Ephemeral,
							embeds: [
								embed_error('Sorry, it seems like this server lacks the level of boost needed for this action!')
							]
						});
					}

					try {
						await message.edit({
							embeds: [clanEmbedBuilder(clanObj)]
						});
					} catch {
						/* do nothing */
					}

					try {
						if (msg.deletable) await msg.delete();
					} catch {
						/* do nothing */
					}
				});

				messageCollector.on('end', async collected => {
					if (collected.size === 0) {
						await buttonInteraction.followUp({
							flags: MessageFlags.Ephemeral,
							embeds: [embed_message("Red", 'No image was provided in the timeframe given!')]
						});
					}
				});
			} else if (buttonInteraction.customId === 'text-channel-button') {
				await buttonInteraction.showModal(channelNameModal);
				try {
					const submit = await buttonInteraction.awaitModalSubmit({
						filter: i => i.user.id === owner.id,
						time: 120_000
					});

					await submit.deferReply({ flags: MessageFlags.Ephemeral });

					const textName = submit.fields.getTextInputValue('channel-name-input');
					const localTriggers = Object.values(local_config.rules.toxic_pattern).flat();
					const badName = await hasBlockedContent(textName, localTriggers, guild);
					if (badName) {
						await submit.editReply({ embeds: [embed_error("Bad word usage in the name!", "Blocked words detected.")] })
						return;
					}

					if (clanObj.textChannel) {
						// if the channel exists, rename it
						await clanObj.textChannel.edit({
							name: textName
						});

						await submit.editReply({
							embeds: [embed_message("Green", `Channel name changed ${clanObj.textChannel}`)]
						});
					} else {
						// create the channel
						clanObj.textChannel = await clanCategory.children.create({
							name: textName,
							type: ChannelType.GuildText,
							permissionOverwrites: clanChannelPermissions
						});

						clanTable.textchannel = clanObj.textChannel.id;
						await ClanRepo.updateByOwner(clanTable); // update the channel id in db

						await submit.editReply({
							embeds: [embed_message("Green", `Text channel created ${clanObj.textChannel}`)]
						});
					}
				} catch {
					await buttonInteraction.followUp({
						flags: MessageFlags.Ephemeral,
						embeds: [embed_message("Red", 'Time ran out!')]
					});
				}

				try {
					await message.edit({
						embeds: [clanEmbedBuilder(clanObj)]
					});
				} catch {
					/* do nothing */
				}
			} else if (buttonInteraction.customId === 'voice-channel-button') {
				await buttonInteraction.showModal(channelNameModal);
				try {
					const submit = await buttonInteraction.awaitModalSubmit({
						filter: i => i.user.id === owner.id,
						time: 120_000
					});

					await submit.deferReply({
						flags: MessageFlags.Ephemeral
					});

					const voiceName = submit.fields.getTextInputValue('channel-name-input');
					const localTriggers = Object.values(local_config.rules.toxic_pattern).flat();
					const badName = await hasBlockedContent(voiceName, localTriggers, guild);
					if (badName) {
						await submit.editReply({ embeds: [embed_error("Bad word usage in the name!", "Blocked words detected.")] })
						return;
					}

					if (clanObj.voice) {
						await clanObj.voice.edit({ name: voiceName });
						await submit.editReply({ embeds: [embed_message("Green", `Channel name changed ${clanObj.voice}`)] });
					} else {
						clanObj.voice = await clanCategory.children.create({
							name: voiceName,
							type: ChannelType.GuildVoice,
							permissionOverwrites: clanChannelPermissions
						});

						clanTable.voicechannel = clanObj.voice.id;
						await ClanRepo.updateByOwner(clanTable);
						await submit.editReply({
							embeds: [embed_message("Green", `Voice channel created ${clanObj.voice}`)]
						});
					}
				} catch {
					await buttonInteraction.followUp({
						flags: MessageFlags.Ephemeral,
						embeds: [embed_message("Red", 'Time ran out')]
					});
				}

				try {
					await message.edit({ embeds: [clanEmbedBuilder(clanObj)] });
				} catch {
					/* do nothing */
				}
			}
		},
		async () => {

		}
	)
}

async function delete_clan_button(interaction: ButtonInteraction<CacheType>, message: Message<boolean>) {
	const guild = interaction.guild as Guild;
	const owner = interaction.member as GuildMember;

	const clanTable = await ClanRepo.getByOwner(guild.id, owner.id);
	if (!clanTable) {
		return await interaction.reply({
			flags: MessageFlags.Ephemeral,
			embeds: [embed_error('While this menu is still active, your clan was deleted.')]
		});
	}

	const clanObject = await clanObjectBuilder(guild, clanTable);
	if (!clanObject) {
		return await interaction.reply({
			flags: MessageFlags.Ephemeral,
			embeds: [embed_error('Despite lacking a clan, this button was active, this is a bug.')]
		});
	}

	const deletionMessage = `Deleting the clan will result into the deletion of all the clan related features: 
        ${clanObject.ownerRole} ${clanObject.clanRole} ${clanObject.voice ?? ''} ${clanObject.textChannel ?? ''}`;

	const reply = await interaction.reply({
		flags: MessageFlags.Ephemeral,
		embeds: [embed_message("Red", deletionMessage, 'Deleting the clan is permanent!')],
		components: [new ActionRowBuilder<ButtonBuilder>().addComponents(confirmDelete)]
	});

	const fetchedReply = await interaction.fetchReply();

	const collector = await message_collector<ComponentType.Button>(fetchedReply,
		{
			componentType: ComponentType.Button,
			time: 120_000,
			filter: (i) => i.user.id === owner.id
		},
		async (buttonInteraction) => {
			if (buttonInteraction.customId === 'confirm-delete-button') {
				await buttonInteraction.deferReply({ flags: MessageFlags.Ephemeral });

				try {
					await clanObject.ownerRole.delete();
					await clanObject.clanRole.delete();
					if (clanObject.voice) await clanObject.voice.delete();
					if (clanObject.textChannel) await clanObject.textChannel.delete();
				} catch (error) {
					if (error instanceof Error) {
						await errorLogHandle(error);
					} else {
						console.error('Unexpected error ', error);
					}

					await buttonInteraction.editReply({
						embeds: [embed_error('An error occured while deleting the clan features!')]
					});
				}

				createClan.setDisabled(false);
				modifyClan.setDisabled(true);
				deleteClan.setDisabled(true);

				const emptyClanEmbed = new EmbedBuilder()
					.setColor('Aqua')
					.setAuthor({
						name: `${owner.user.username}'s clan profile`,
						iconURL: owner.user.displayAvatarURL({ extension: 'png' })
					})
					.setTitle("You don't own a clan yet!")
					.setDescription('Use the button `Create clan` and follow the required steps.');

				try {
					await message.edit({
						embeds: [emptyClanEmbed],
						components: [new ActionRowBuilder<ButtonBuilder>().addComponents(createClan, modifyClan, deleteClan)]
					});
				} catch (error) {
					if (error instanceof Error) {
						await errorLogHandle(error);
					} else {
						console.error('Unexpected error', error);
					}
				}

				await buttonInteraction.editReply({
					embeds: [embed_message("Aqua", 'You no longer have a clan.')]
				});

				await ClanRepo.deleteByOwner(guild.id, owner.id) // deleting the clan from database
				collector.stop();
			}
		},
		async () => {
			try {
				await reply.edit({
					components: [],
					embeds: [embed_message("Aqua", 'Interaction ended.')]
				});
			} catch {
				/* do nothing */
			}
		}
	)

}

async function main_menu_collector(message: Message<boolean>, owner: GuildMember) {
	const cooldowns = new Collection<Snowflake, number>();
	const cd = 10_000;
	await message_collector<ComponentType.Button>(message,
		{
			componentType: ComponentType.Button,
			time: 600_000,
			filter: (i) => i.user.id === owner.id
		},
		async (buttonInteraction) => {
			const userCooldown = hasCooldown(buttonInteraction.user.id, cooldowns, cd);
			if (userCooldown) {
				const expirationTimestamp = Math.floor(userCooldown / 1000);
				await buttonInteraction.reply({
					flags: MessageFlags.Ephemeral,
					embeds: [
						embed_message("Red", `The buttons are on cooldown! <t:${expirationTimestamp}:R>`)
					]
				});
				return;
			}

			// if the user is no longer on cooldown
			cooldowns.set(buttonInteraction.user.id, Date.now());
			setTimeout(() => cooldowns.delete(buttonInteraction.user.id), cd);

			switch (buttonInteraction.customId) {
				case 'create-clan':
					await create_clan_button(buttonInteraction, message);
					break;
				case 'modify-clan':
					await modify_clan_button(buttonInteraction, message);
					break;
				case 'delete-clan':
					await delete_clan_button(buttonInteraction, message);
					break;
			}
		},
		async () => {
			try {
				if (message.deletable) {
					await message.delete();
				} else {
					await message.edit({
						components: [],
						embeds: [
							embed_message("Aqua", 'Interaction ended.')
						]
					});
				}
			} catch {
				/* do nothing */
			}
		}
	);
}

/**
 * Opens an interactive menu to create, manage and delete a clan
 */
export async function clan_main_menu(
	interaction: ChatInputCommandInteraction<CacheType>,
	owner: GuildMember,
	clan: ClanTable | null
) {
	const guild = interaction.guild;
	if (!guild) return;

	await interaction.deferReply();
	let mainEmbed = new EmbedBuilder().setColor('Aqua').setAuthor({
		name: `${owner.user.username}'s clan profile`,
		iconURL: `${owner.user.displayAvatarURL({ extension: 'jpg' })}`
	});

	if (clan === null) {
		// if user's clan is null, it means the user has no clan yet
		createClan.setDisabled(false);
		modifyClan.setDisabled(true);
		deleteClan.setDisabled(true);
		mainEmbed.setTitle("You don't own a clan yet!")
			.setDescription('Use the button `Create clan` and follow the required steps.');
	} else {
		createClan.setDisabled(true); // can't create more than one clan
		modifyClan.setDisabled(false);
		deleteClan.setDisabled(false);

		const clanObject: ClanObject | null = await clanObjectBuilder(guild, clan);

		if (!clanObject)
			return await interaction.editReply({
				embeds: [
					embed_error('Something went wrong while fetching your clan, if the problem perists, contact an administrator!')
				]
			});

		mainEmbed = clanEmbedBuilder(clanObject);
	}

	await interaction.editReply({
		embeds: [mainEmbed],
		components: [new ActionRowBuilder<ButtonBuilder>().addComponents(createClan, modifyClan, deleteClan)]
	});

	const message = await interaction.fetchReply();
	await main_menu_collector(message, owner);
}
