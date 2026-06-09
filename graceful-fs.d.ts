import { EmbedBuilder, Guild, GuildMember, Role, TextChannel, VoiceChannel } from "discord.js";
import { ClanTable } from "../../Interfaces/database_types.js";
import { ClanObject } from "../../Interfaces/helper_types.js";
import { fetchGuildMember, fetchGuildRole, fetchGuildVoiceChannel, fetchGuildTextChannel } from "../../utility_modules/discord_helpers.js";

/**
 * Build an embed from the ClanObject provided.
 * 
 * ClanObject is the ClanTable variant of fetched discordjs objects.
 */
export function clanEmbedBuilder(clan: ClanObject): EmbedBuilder {
  return new EmbedBuilder()
    .setColor('Aqua')
    .setAuthor({
      name: `${clan.owner.user.username}'s clan profile`,
      iconURL: `${clan.owner.displayAvatarURL({ extension: 'jpg' })}`
    })
    .setTitle(`${clan.clanname} clan`)
    .setThumbnail(clan.ownerRole.iconURL({ extension: 'jpg' }))
    .addFields(
      {
        name: 'Total Clan Members',
        value: `${clan.clanRole.members.size + 1}`
      },
      {
        name: 'Owner role',
        value: `${clan.ownerRole}`
      },
      {
        name: 'Clan role',
        value: `${clan.clanRole}`
      },
      {
        name: 'Hexcolor',
        value: `${clan.ownerRole.hexColor}`
      },
      {
        name: 'Voice',
        value: `${clan.voice ?? 'None'}`
      },
      {
        name: 'Text Channel',
        value: `${clan.textChannel ?? 'None'}`
      }
    );
}

/**
 * Convert the database version of the clan into an object with guild elements
 * ClanTable -> ClanObject
 * For example instead of clanrole being a Snowflake, it is converted into the Role object
 *
 * If non null parameters fail to be fetched, the function will return null
 */
export async function clanObjectBuilder(guild: Guild, clanTable: ClanTable): Promise<ClanObject | null> {
  if (!clanTable.clanname || !clanTable.owner || !clanTable.clanrole || !clanTable.ownerrole) return null;

  const owner: GuildMember | null = await fetchGuildMember(guild, clanTable.owner);
  if (!owner) return null;

  const ownerRole: Role | null = await fetchGuildRole(guild, clanTable.ownerrole);
  if (!ownerRole) return null;

  const clanRole: Role | null = await fetchGuildRole(guild, clanTable.clanrole);
  if (!clanRole) return null;

  const voice: VoiceChannel | null = clanTable.voicechannel 
    ? await fetchGuildVoiceChannel(guild, clanTable.voicechannel) 
    : null;

  const textChannel: TextChannel | null = clanTable.textchannel 
    ? await fetchGuildTextChannel(guild, clanTable.textchannel) 
    : null;

  const clanObject: ClanObject = {
    guild: guild,
    owner: owner,
    clanname: clanTable.clanname,
    ownerRole: ownerRole,
    clanRole: clanRole,
    voice: voice,
    textChannel: textChannel
  };

  return clanObject;
}

/**
 * Deconstruct the ClanObject into database digestable object (ClanTable)
 */
export function clanObjectToTable(clan: ClanObject): ClanTable {
  const clanTable: ClanTable = {
    guild: clan.guild.id,
    owner: clan.owner.id,
    clanname: clan.clanname,
    ownerrole: clan.ownerRole.id,
    clanrole: clan.clanRole.id,
    textchannel: clan.textChannel ? clan.textChannel.id : null,
    voicechannel: clan.voice ? clan.voice.id : null
  };

  return clanTable;
}
