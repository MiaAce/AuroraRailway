import type { Event } from "../../Interfaces/event.js";
import type { Guild, GuildMember } from "discord.js";
import { fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { embed_member_joined } from "../../utility_modules/embed_builders.js";

export type guildMemberAddHook = (member: GuildMember) => Promise<void>;
const hooks: guildMemberAddHook[] = [];
export function extend_guildMemberAdd(hook: guildMemberAddHook) {
    hooks.push(hook);
}

async function runHooks(member: GuildMember) {
    for(const hook of hooks) {
        try {
            await hook(member);
        } catch(error) {
            await errorLogHandle(error);
        }
    }
}

const guildMemberAdd: Event = {
    name: "guildMemberAdd",
    async execute(member: GuildMember) {
        const guild: Guild = member.guild;
        if(member.user.bot) return;
        
        await runHooks(member);

        // log as user-activity
        const userActivityLogs = await fetchLogsChannel(guild, "user-activity");
        if(userActivityLogs) {
            try {
                userActivityLogs.send({
                    embeds: [
                        embed_member_joined(member)
                    ]
                });
            } catch(error) {
                await errorLogHandle(error);
            }
        }
    }
}

export default guildMemberAdd;