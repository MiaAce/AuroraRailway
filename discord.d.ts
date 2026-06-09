import { ChatInputCommandInteraction, CacheType, Guild, MessageFlags } from "discord.js";
import { ClanObject } from "../../Interfaces/helper_types.js";
import { clanObjectBuilder, clanEmbedBuilder } from "./clanGuildBuilder.js";
import ClanRepo from "../../Repositories/clan.js";
import { embed_error } from "../../utility_modules/embed_builders.js";

/**
 * Fetch the clan by clan name and reply to the interaction with the embeded clan details
 */
export async function clan_details(interaction: ChatInputCommandInteraction<CacheType>, clanName: string) {
	const guild = interaction.guild as Guild;
	const clan = await ClanRepo.getByClanName(guild.id, clanName);

	if (!clan) {
		return await interaction.reply({
			flags: MessageFlags.Ephemeral,
			embeds: [
				embed_error("The clan you are looking for doesn't exist. Check spelling and letter casing.")
			]
		});
	}

	const clanObj: ClanObject | null = await clanObjectBuilder(guild, clan);
	if (!clanObj) {
		return await interaction.reply({
			flags: MessageFlags.Ephemeral,
			embeds: [
				embed_error('Fatal error, failed to fetch the clan object...')
			]
		});
	}

	const clanEmbed = clanEmbedBuilder(clanObj);

	await interaction.reply({
		embeds: [clanEmbed]
	});
}
