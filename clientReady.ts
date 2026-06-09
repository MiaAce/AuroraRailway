import { Guild, GuildMember, GuildMemberRoleManager, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { clan_details } from "../../Systems/clan/clanDetails.js";
import { leave_clan } from "../../Systems/clan/clanLeave.js";
import { send_invite } from "../../Systems/clan/clanSendInvite.js";
import { fetchGuildCategory, fetchGuildMember, fetchPremiumRole } from "../../utility_modules/discord_helpers.js";
import ClanSystemRepo from "../../Repositories/clansystem.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { ClanTable } from "../../Interfaces/database_types.js";
import ClanRepo from "../../Repositories/clan.js";
import { clan_main_menu } from "../../Systems/clan/clanMainMenu.js";

const clanCommand: ChatCommand = {
	data: new SlashCommandBuilder()
		.setName("clan")
		.setDescription("Clan related commands")
		.addSubcommand(subcommand =>
			subcommand.setName('menu')
				.setDescription('Open your clan menu as a supporter')
		)
		.addSubcommand(subcommand =>
			subcommand.setName('invite')
				.setDescription('Invite another member to your clan.')
				.addUserOption(option =>
					option.setName('member')
						.setDescription('The member to be invited to your clan.')
						.setRequired(true)
				)
		)
		.addSubcommand(subcommand =>
			subcommand.setName('kick')
				.setDescription('Kick one of your clan members.')
				.addUserOption(option =>
					option.setName('member')
						.setDescription('The clan member to be kicked out.')
						.setRequired(true)
				)
		)
		.addSubcommand(subcommand =>
			subcommand.setName('leave')
				.setDescription('Leave from one of your current clans.')
		)
		.addSubcommand(subcommand =>
			subcommand.setName('details')
				.setDescription('Details about a clan.')
				.addStringOption(option =>
					option.setName('clan-name')
						.setDescription('The name of the clan you want details about.')
						.setRequired(true)
						.setMaxLength(100)
						.setMinLength(1)
				)
		)
		.toJSON(),
	metadata: {
		botPermissions: [
			PermissionFlagsBits.ManageChannels,
			PermissionFlagsBits.ManageRoles,
			PermissionFlagsBits.ViewAuditLog
		],
		userPermissions: [],
		cooldown: 10,
		scope: "guild",
		category: "Premium",
		group: "clan"
	},
	async execute(interaction, client) {
		if (!interaction.member) {
			console.error("In /clan interaction.member is somehow null")
			return; // stop typescript from screaming
		}
		if (!interaction.guild) {
			console.error("In /clan interaction.guild is somehow null")
			return; // stop typescript from screaming
		}

		const guild: Guild = interaction.guild;
		const options = interaction.options;

		const subcommand = options.getSubcommand();
		const user = options.getUser('member');
		let member: GuildMember | null = null;
		let isClanMember: boolean = false;

		const premiumRole = await fetchPremiumRole(client, guild);
		if (premiumRole === null) {
			await interaction.reply({
				embeds: [
					embed_error("There is no premium role set on this server, you can not run this command.")
				],
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		const clanCategoryId = await ClanSystemRepo.getCategory(guild.id);
		if (clanCategoryId === null) {
			await interaction.reply({
				embeds: [
					embed_error("There is no clan system set up on this server, you can not use this command.")
				],
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		const clanCategory = await fetchGuildCategory(guild, clanCategoryId);
		if (clanCategory === null) {
			await interaction.reply({
				embeds: [
					embed_error("Failed to fetch the clan system category from database, notify an admin.", "Faulty row")
				],
				flags: MessageFlags.Ephemeral
			});

			// clean up the faulty row
			await ClanSystemRepo.delete(guild.id);
			return;
		}

		// attempt to fetch the interaction user's clan if they own one
		const clanTable: ClanTable | null = await ClanRepo.getByOwner(guild.id, interaction.user.id);

		if (user) {
			if (user.bot) {
				await interaction.reply({
					embeds: [
						embed_error('You can not target bots!')
					],
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			if (user.id === interaction.user.id) {
				await interaction.reply({
					embeds: [
						embed_error('You can not target yourself')
					],
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			member = await fetchGuildMember(guild, user.id);
			if (!member) {
				await interaction.reply({
					embeds: [
						embed_error('The member provided is not of this guild!')
					],
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			if (clanTable) {
				isClanMember = member.roles.cache.has(clanTable.clanrole);
			}
		}

		if (subcommand != 'leave' && subcommand != 'details') {
			// leave and details can be used by anyone, check for permission for the other subcommands
			// which are premium specific
			if (interaction.member.roles instanceof GuildMemberRoleManager && !interaction.member.roles.cache.has(premiumRole.id)) {
				// if a member doesn't have the premium role, the member lacks permission
				await interaction.reply({
					embeds: [
						embed_error('You need to be a premium member to use that!')
					],
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			if (subcommand != 'menu') {
				// menu can be ran by any premium member
				// kick and invite subcommands can only be ran by clan owners

				if (clanTable === null) {
					// if fetching the clan of the interaction member returns null
					// it means the premium member is not a clan owner yet
					await interaction.reply({
						embeds: [
							embed_error('These commands require you to own a clan.')
						],
						flags: MessageFlags.Ephemeral
					});
					return;
				}
			}
		}

		switch (subcommand) {
			case 'menu': {
				await clan_main_menu(interaction, interaction.member as GuildMember, clanTable);
				break;
			}
			case 'invite': {
				// TODO: CHECK FOR BLOCKLIST
				// TODO: ADD COOLDOWN PER INVITER-INVITED PAIR
				if (isClanMember) {
					await interaction.reply({
						flags: MessageFlags.Ephemeral,
						embeds: [
							embed_error('You can not invite a member that is in your clan already!')
						]
					});
					return;
				}
				if (member) {
					await send_invite(interaction, member);
				} else {
					await interaction.reply({
						flags: MessageFlags.Ephemeral,
						embeds: [
							embed_error('There was something wrong while trying to fetch the targeted member.')
						]
					});
					return;
				}
				break;
			}

			case 'kick': {
				if (member) {
					if (!isClanMember) {
						await interaction.reply({
							flags: MessageFlags.Ephemeral,
							embeds: [
								embed_error('You can not kick someone that is not in your clan!')
							]
						});

						return;
					} else {
						await member.roles.remove(clanTable!.clanrole); // clanTable is ensured by the checks before the switch
						await interaction.reply({
							flags: MessageFlags.Ephemeral,
							embeds: [
								embed_message("Green", `You kicked ${member} out of your clan.`)
							]
						});
					}
				} else {
					await interaction.reply({
						flags: MessageFlags.Ephemeral,
						embeds: [
							embed_error('There was something wrong while trying to fetch the targeted member.')
						]
					});
					return;
				}
				break;
			}

			case 'leave': {
				await leave_clan(interaction);
				break;
			}

			case 'details': {
				const clanName = options.getString('clan-name', true);
				await clan_details(interaction, clanName);
				break;
			}

		}

		return true;
	}
}

export default clanCommand;