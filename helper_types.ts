import { Guild, Role } from "discord.js";
import type { Event } from "../../Interfaces/event.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { ColumnValuePair } from "../../Interfaces/database_types.js";
import DatabaseRepo from "../../Repositories/database_repository.js";
import ClanRepo from "../../Repositories/clan.js";
import LfgSystemRepo from "../../Repositories/lfgsystem.js";

export type roleDeleteHook = (role: Role) => Promise<void>;
const hooks: roleDeleteHook[] = [];
export function extend_roleDelete(hook: roleDeleteHook) {
    hooks.push(hook);
}

async function runHooks(role: Role) {
    for(const hook of hooks) {
        try {
            await hook(role);
        } catch(error) {
            await errorLogHandle(error);
        }
    }
}

const roleDelete: Event = {
    name: "roleDelete",
    async execute(role: Role) {
        /**
         * Deleting a role used or registered by one or more database tables must be curated
         */
        const guild: Guild = role.guild;
        const property: ColumnValuePair = {column: "role", value: role.id}
        const roleTablesToBeCleaned = await DatabaseRepo.getTablesWithColumnValue(property);
        for(const table of roleTablesToBeCleaned) {
            await DatabaseRepo.wipeGuildRowsWithProperty(guild.id, table, property);
        }

        // handle deleting clan or owner role from clans
        await ClanRepo.onAnyClanRoleDelete(guild.id, role);
        // clean lfg-system related roles
        await LfgSystemRepo.deleteOneLfgRoleBySnowflake(role.id);

        await runHooks(role);


    }
}

export default roleDelete;