# Events
Events are scripts that execute every time the Discord API triggers the event of the same name as the script.

## Categories
Events are separated by categories based on where the event happens

- Client: Bot specific events
- Guild: Events related to guilds and guild specific objects such as members
- interactionCreate: Events triggered by Discord Interactions such as Slash Commands. Single event source category

## Client events
- clientReady: It's a once event that readies the bot's processes and systems in the first moment of it going online
- error: Handles uncaught errors specific to Discord API

## Guild events implemented

- channelCreate
- channelDelete
- channelUpdate
- guildAuditLogEntryCreate
- guildBanAdd
- guildBanRemove
- guildDelete
- guildMemberAdd
- guildMemberRemove
- guildMemberUpdate
- inviteCreate
- messageCreate
- messageDelete

## Event hooks

In order for the events to be used as a base without modifying the source files, hooks are implemented

```js
export type inviteCreateHook = (invite: Invite) => Promise<void>;
const hooks: inviteCreateHook[] = [];
export function extend_inviteCreate(hook: inviteCreateHook) {
    hooks.push(hook);
}

async function runHooks(invite: Invite) {
    for(const hook of hooks) {
        try {
            await hook(invite);
        } catch(error) {
            await errorLogHandle(error);
        }
    }
}
```

Such as the example above; runHooks() is called inside the event execute body.

Event hooks are to be written inside the source file: source/utility_modules/event_hooks.js using the OnReadyTaskBuilder template.