import { Event } from "../../Interfaces/event.js";
import type { GuildMember } from "discord.js";
import { fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import { embed_member_left } from "../../utility_modules/embed_builders.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

export type guildMemberRemoveHook = (member: GuildMember) => Promise<void>;
const hooks: guildMemberRemoveHook[] = [];
export function extend_guildMemberRemove(hook: guildMemberRemoveHook) {
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

const guildMemberRemove: Event = {
    name: "guildMemberRemove",
    async execute(member: GuildMember) {
        if(member.user.bot) return;
        
        await runHooks(member);
        
        const guild = member.guild;
        const userActivityLogs = await fetchLogsChannel(guild, "user-activity");
        if(userActivityLogs) {
            try {
                userActivityLogs.send({
                    embeds: [
                        embed_member_left(member)
                    ]
                });
            } catch(error) {
                await errorLogHandle(error);
            }
        }
    }
}

export default guildMemberRemove;