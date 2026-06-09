import type { Event } from "../../Interfaces/event.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Role, TextChannel, type Guild, type GuildMember } from "discord.js";
import { fetchGuildChannel, fetchGuildRole, fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import { embed_kofi_announcement, embed_member_update_name } from "../../utility_modules/embed_builders.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import KofiIntegrationRepo from "../../Repositories/kofiintegration.js";
import ServerRolesRepo from "../../Repositories/serverroles.js";

export type guildMemberUpdateHook = (oldMember: GuildMember, newMember: GuildMember) => Promise<void>;
const hooks: guildMemberUpdateHook[] = [];
export function extend_guildMemberUpdate(hook: guildMemberUpdateHook) {
    hooks.push(hook);
}

async function runHooks(oldMember: GuildMember, newMember: GuildMember) {
    for (const hook of hooks) {
        try {
            await hook(oldMember, newMember);
        } catch (error) {
            await errorLogHandle(error);
        }
    }
}

const guildMemberUpdate: Event = {
    name: "guildMemberUpdate",
    async execute(oldMember: GuildMember, newMember: GuildMember) {
        const guild: Guild = newMember.guild;
        if (newMember.user.bot) return; // ignore bots

        // ko-fi announcement
        const kofi = await KofiIntegrationRepo.getIntegration(guild.id);
        const premiumId = await ServerRolesRepo.getGuildPremiumRole(guild.id);
        const kofiTiers = await KofiIntegrationRepo.getTiers(guild.id);
        // execute only if there is an integration, premium role and tier
        if (kofi && premiumId && kofiTiers.length > 0) {
            // check if the member got the premium role
            const tier = kofiTiers.find(tier => newMember.roles.cache.has(tier.role));
            if (tier && newMember.roles.cache.has(premiumId)) {
                if (!oldMember.roles.cache.has(tier.role) && newMember.roles.cache.has(tier.role)) {
                    // reaching here means the member got premium and a ko-fi tier
                    // the announcement channel must be fetched and the announcement must be built and sent
                    const announcementChannel = await fetchGuildChannel(guild, kofi.announcement_channel);
                    if (!(announcementChannel instanceof TextChannel)) {
                        // faulty row, delete it
                        await KofiIntegrationRepo.deleteIntegration(guild.id);
                    } else {
                        const role = await fetchGuildRole(guild, tier.role) as Role; // since the role was found in member's roles cache, it means it's valid
                        announcementChannel.send({
                            embeds: [embed_kofi_announcement(guild, newMember, tier.tier, role)],
                            components: [
                                new ActionRowBuilder<ButtonBuilder>().addComponents(
                                    new ButtonBuilder()
                                        .setLabel("Sustine!")
                                        .setURL("https://ko-fi.com/valorant_romania/tiers")
                                        .setStyle(ButtonStyle.Link)
                                )
                            ]
                        });
                    }

                }
            }
        }

        await runHooks(oldMember, newMember);
        // log name changes
        const userActivityLogs = await fetchLogsChannel(guild, "user-activity");
        if (userActivityLogs) {
            let nameType: string = "";

            if (oldMember.displayName !== newMember.displayName) {
                nameType = "displayname";
            } else if (oldMember.user.username !== newMember.user.username) {
                nameType = "username";
            }

            // if nameType remains empty string, then the member update was not a name update
            if (nameType === "displayname" || nameType === "username") {
                try {
                    await userActivityLogs.send({
                        embeds: [
                            embed_member_update_name(oldMember, newMember, nameType)
                        ]
                    })
                } catch (error) {
                    await errorLogHandle(error);
                }
            }
        }
    }
}

export default guildMemberUpdate;