import type { Event } from "../../Interfaces/event.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { fetchGuildMember } from "../../utility_modules/discord_helpers.js";
import { Message, MessageReaction, User } from "discord.js";

export type messageReactionRemoveHook = (reaction: MessageReaction, user: User) => Promise<void>;
const hooks: messageReactionRemoveHook[] = [];

export function extend_messageReactionRemove(hook: messageReactionRemoveHook) {
    hooks.push(hook);
}

async function runHooks(reaction: MessageReaction, user: User) {
    for (const hook of hooks) {
        try {
            await hook(reaction, user);
        } catch (error) {
            await errorLogHandle(error);
        }
    }
}

const messageReactionRemove: Event = {
    name: "messageReactionRemove",
    async execute(reaction: MessageReaction, user: User) {
        if(user.bot) return;

        const message = reaction.message;
        const guild = reaction.message.guild;

        if(!(message instanceof Message) || !guild) return; // ignore non guild reactions

        // const channel = message.channel;
        const member = await fetchGuildMember(guild, user.id);
        if(!member) return;

        await runHooks(reaction, user);
    }
}

export default messageReactionRemove;