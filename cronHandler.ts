import {
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	CacheType,
	GuildMember,
	Guild,
	MessageFlags,
	ActionRowBuilder,
	ComponentType
} from "discord.js";
import { clanObjectBuilder, clanEmbedBuilder } from "./clanGuildBuilder.js";
import { ClanObject } from "../../Interfaces/helper_types.js";
import ClanRepo from "../../Repositories/clan.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { message_collector } from "../../utility_modules/discord_helpers.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

export const confirmInvite = new ButtonBuilder()
	.setCustomId('confirm-invite')
	.setLabel('Confirm')
	.setStyle(ButtonStyle.Success);

export const denyInvite = new ButtonBuilder()
	.setCustomId('deny-invite')
	.setLabel('Deny')
	.setStyle(ButtonStyle.Danger);

export async function send_invite(interaction: ChatInputCommandInteraction<CacheType>, member: GuildMember) {
	const guild = interaction.guild as Guild;
	const owner = interaction.member as GuildMember;

	const clanTable = await ClanRepo.getByOwner(guild.id, owner.id);
	if (!clanTable) {
		return await interaction.reply({
			flags: MessageFlags.Ephemeral,
			embeds: [
				embed_error("You can't use this command without owning a clan!")
			]
		});
	}

	const clanObj: ClanObject | null = await clanObjectBuilder(guild, clanTable);

	if (!clanObj) {
		return await interaction.reply({
			flags: MessageFlags.Ephemeral,
			embeds: [
				embed_error('Looks like there was a problem while fetching your clan object...')
			]
		});
	}

	const inviteEmbed = clanEmbedBuilder(clanObj);

	inviteEmbed.setAuthor({
		name: `${owner.user.username} invites ${member.user.username} to their clan`,
		iconURL: owner.displayAvatarURL({ extension: 'jpg' })
	});

	await interaction.reply({
		embeds: [inviteEmbed],
		content: `${member} you've been invited to **${clanObj.clanname}**.`,
		components: [new ActionRowBuilder<ButtonBuilder>().addComponents(confirmInvite, denyInvite)]
	});

	const reply = await interaction.fetchReply();
	const collector = await message_collector<ComponentType.Button>(reply,
		{
			componentType: ComponentType.Button,
			time: 15 * 60_000, //15 min
			filter: (i) => i.user.id === member.id
		},
		async (buttonInteraction) => {
			if (buttonInteraction.customId === 'confirm-invite') {
				try {
					await member.roles.add(clanObj.clanRole);
				} catch (error) {
					if (error instanceof Error) {
						await errorLogHandle(error);
					} else {
						console.error('Unexpected error: ', error);
					}
				}

				try {
					await reply.edit({
						embeds: [
							embed_message("Aqua", `${member} has become member **#${clanObj.clanRole.members.size + 1}** of the **${clanObj.clanname}** clan.`)
						],
						components: [],
						content: 'Invite accepted'
					});
				} catch {
					/* do nothing */
				}

				await buttonInteraction.reply({
					flags: MessageFlags.Ephemeral,
					embeds: [
						embed_message("Green", `You joined the **${clanObj.clanname}** clan.`)
					]
				});
			} else if (buttonInteraction.customId === 'deny-invite') {
				await buttonInteraction.reply({
					flags: MessageFlags.Ephemeral,
					embeds: [
						embed_message("Green", 'You denied the clan invitation.')
					]
				});

				collector.stop();
			}
		},
		async () => {
			try {
				if (reply.deletable) await reply.delete();
			} catch {
				/* do nothing */
			}
		}
	);
}
