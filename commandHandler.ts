import type { Event } from "../../Interfaces/event.js";
import { type GuildTextBasedChannel, type Message } from "discord.js";
import ServerLogsIgnoreRepo from "../../Repositories/serverlogsignore.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

export type messageCreateHook = (message: Message) => Promise<void>;
const hooks: messageCreateHook[] = [];
export function extend_messageCreate(hook: messageCreateHook) {
    hooks.push(hook);
}

async function runHooks(message: Message) {
    for(const hook of hooks) {
        try {
            await hook(message);
        } catch(error) {
            await errorLogHandle(error);
        }
    }
}

const messageCreate: Event = {
    name: "messageCreate",
    async execute(message: Message) {
        if(!message.guild || !message.member || message.author.bot) return;
        const guild = message.guild;
        const channel = message.channel as GuildTextBasedChannel;
        
        const isChannelIgnored = await ServerLogsIgnoreRepo.isChannelIgnored(guild.id, channel.id);
        if(isChannelIgnored) return;

        await runHooks(message);
        
    }
}

export default messageCreate;