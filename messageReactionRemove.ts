import type { Event } from "../../Interfaces/event.js";
import type { Guild } from "discord.js";
import GuildModulesRepo from "../../Repositories/guildmodules.js";
import LfgSystemRepo from "../../Repositories/lfgsystem.js";

const guildCreate: Event = {
    name: "guildCreate",
    async execute(guild: Guild) {
        await GuildModulesRepo.default(guild.id); // set default disabled modules to none (empty array)
        await LfgSystemRepo.initSystemConfig(guild.id);
    }
}

export default guildCreate;