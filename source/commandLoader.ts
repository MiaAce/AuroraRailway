import { Collection } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import type { ChatCommand } from './types/command.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Runtime guard — verifies that an imported module default export
 * satisfies the ChatCommand interface shape.
 */
function isChatCommand(value: unknown): value is ChatCommand {
    return (
        typeof value === 'object' &&
        value !== null &&
        'data' in value &&
        'execute' in value &&
        'metadata' in value &&
        typeof (value as ChatCommand).data === 'object' &&
        typeof (value as ChatCommand).execute === 'function' &&
        typeof (value as ChatCommand).metadata === 'object'
    );
}

/**
 * Scans the `commands/` directory (sibling to this file) for `.js` files,
 * dynamically imports each one, and collects valid ChatCommand exports into
 * a Collection keyed by command name.
 *
 * Files that do not export a valid ChatCommand or are marked as disabled
 * are skipped with a warning.
 *
 * @returns A Collection mapping command names to their ChatCommand objects.
 */
export async function loadCommands(): Promise<Collection<string, ChatCommand>> {
    const commands = new Collection<string, ChatCommand>();
    const commandsDir = join(__dirname, 'commands');

    let files: string[];
    try {
        files = readdirSync(commandsDir).filter(
            (f) => f.endsWith('.js') && !f.endsWith('.d.js')
        );
    } catch {
        console.warn(
            `[CommandLoader] Commands directory not found at ${commandsDir}. No commands loaded.`
        );
        return commands;
    }

    for (const file of files) {
        const filePath = join(commandsDir, file);
        const fileUrl = pathToFileURL(filePath).href;

        try {
            const module = await import(fileUrl);
            const command: unknown = module.default ?? module;

            if (!isChatCommand(command)) {
                console.warn(
                    `[CommandLoader] Skipping ${file}: does not export a valid ChatCommand.`
                );
                continue;
            }

            if (command.metadata.disabled) {
                console.log(`[CommandLoader] Skipping ${file}: command is disabled.`);
                continue;
            }

            commands.set(command.data.name, command);
            console.log(`[CommandLoader] Loaded command: ${command.data.name}`);
        } catch (error) {
            console.error(`[CommandLoader] Failed to load ${file}:`, error);
        }
    }

    console.log(`[CommandLoader] ${commands.size} command(s) loaded.`);
    return commands;
}
