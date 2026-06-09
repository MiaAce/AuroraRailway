import type { Event } from "../../Interfaces/event.js";
import { AuditLogEvent, type Guild, type GuildBan } from "discord.js";
import { fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import { get_env_var } from "../../utility_modules/utility_methods.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { embed_unban } from "../../utility_modules/embed_builders.js";

export type guildBanRemoveHook = (ban: GuildBan) => Promise<void>;
const hooks: guildBanRemoveHook[] = [];
export function extend_guildBanRemove(hook: guildBanRemoveHook) {
    hooks.push(hook);
}

async function runHooks(ban: GuildBan) {
    for(const hook of hooks) {
        try {
            await hook(ban);
        } catch(error) {
            await errorLogHandle(error);
        }
    }
}

const guildBanRemove: Event = {
    name: "guildBanRemove",
    async execute(ban: GuildBan) {
        const guild: Guild = ban.guild;

        await runHooks(ban);
        
        const logChannel = await fetchLogsChannel(guild, "moderation");
        if (!logChannel) return;

        const unbanAudit = await guild.fetchAuditLogs({
            type: AuditLogEvent.MemberBanRemove,
            limit: 1
        });

        const entry = unbanAudit.entries.first();

        if (!entry || !entry.target || !entry.executor) return;
        if (entry.executor.id === get_env_var("CLIENT_ID")) return;
        if (entry.target.id !== ban.user.id) return; // ignore if the entry's target is not the unban user

        const reason = entry.reason ?? "No reason specified";

        try {
            await logChannel.send({
                embeds: [
                    embed_unban(
                        ban.user.id,
                        entry.executor.username ?? `${entry.executor.id}`,
                        reason
                    )
                ]
            });
        } catch(error) {
            await errorLogHandle(error, `Failed to log guildBanRemove event from ${guild.name}[${guild.id}]`);
        }
    }
}

export default guildBanRemove;