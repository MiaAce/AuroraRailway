import {
	ChatInputCommandInteraction,
	CacheType,
	Guild,
	GuildMember,
	MessageFlags,
	StringSelectMenuBuilder,
	ActionRowBuilder,
	ComponentType
} from "discord.js";
import ClanRepo from "../../Repositories/clan.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { message_collector } from "../../utility_modules/discord_helpers.js";

/**
 * Open the menu and handle clan member attempting to leave one or more clans that they are a part of
 */
export async function leave_clan(interaction: ChatInputCommandInteraction<CacheType>) {
	const guild = interaction.guild as Guild;
	const member = interaction.member as GuildMember;

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const reply = await interaction.fetchReply();

	const roleIds = new Set(member.roles.cache.map(role => role.id));

	const allClans = await ClanRepo.guildClans(guild.id);
	// fetching the clan from database based on interaction member roles
	// if the member has clanroles, the member is part of those clans
	const memberClans = allClans.filter(clan => clan.clanrole && roleIds.has(clan.clanrole));
	if (memberClans.length === 0) {
		return await interaction.editReply({
			embeds: [
				embed_error('You are not a member of any clans.')
			]
		});
	}

	if (memberClans.length === 1) {
		const clan = memberClans[0]!;
		try {
			await member.roles.remove(clan.clanrole);
		} catch (error) {
			if (error instanceof Error) {
				await errorLogHandle(error);
			} else {
				console.error('Unexpected error', error);
			}

			return await interaction.editReply({
				embeds: [
					embed_error('Something went wrong while leaving the clan...')
				]
			});
		}

		return await interaction.editReply({
			embeds: [
				embed_error(`You left from ${clan.clanname} clan.`)
			]
		});
	}

	const clanOptions = [];
	for (const clan of memberClans) {
		clanOptions.push({
			label: clan.clanname,
			value: `${clan.clanrole}`,
			description: `Leave from ${clan.clanname}`
		});
	}

	const selectClanMenu = new StringSelectMenuBuilder()
		.setCustomId('select-clan')
		.setPlaceholder('Select the clan you want to leave')
		.setMinValues(1)
		.setMaxValues(clanOptions.length)
		.addOptions(clanOptions);

	const selectActionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectClanMenu);

	await interaction.editReply({
		components: [selectActionRow]
	});

	const collector = await message_collector<ComponentType.StringSelect>(reply,
		{
			componentType: ComponentType.StringSelect,
			time: 120_000,
			filter: (i) => i.user.id === member.id
		},
		async (selectInteraction) => {
			for (const roleId of selectInteraction.values) {
				try {
					await member.roles.remove(roleId);
				} catch (error) {
					if (error instanceof Error) {
						await errorLogHandle(error);
					} else {
						console.error('Unexpected error', error);
					}

					await selectInteraction.reply({
						flags: MessageFlags.Ephemeral,
						embeds: [
							embed_error('Something went wrong while leaving the clans...')
						]
					});
					return;
				}
			}

			const selectedRoleIds = new Set(selectInteraction.values);
			const leftFromClans = memberClans.filter(entry => selectedRoleIds.has(entry.clanrole));

			await selectInteraction.reply({
				flags: MessageFlags.Ephemeral,
				embeds: [
					embed_message("Green", `You left from ${leftFromClans.map(clan => clan.clanname).join(', ')}`)
				]
			});

			collector.stop();
		},
		async () => {
			try {
				await interaction.editReply({
					components: [],
					embeds: [
						embed_message("Aqua", 'Interaction ended.')]
				});
			} catch {
				/* do nothing */
			}
		}
	);
}
