const { config } = require("../_utils/config");
const { PermissionFlagsBits } = require("discord.js");

async function archive_channel(interaction, activeBounty, command_str) {
  const parsedChannel = interaction.guild.channels.cache.find(
    (channel) => channel.name === config.archives_category
  );

  await interaction.channel.send({
    content: `${command_str} Archived`,
    components: [],
  });

  await activeBounty.channel.setParent(parsedChannel.id);

  const roleNITeam = interaction.guild.roles.cache.find(
    (role) => role.name === config.team_role_name
  );

  await activeBounty.channel.permissionOverwrites.set([
    {
      id: interaction.guild.roles.everyone,
      deny: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.CreatePrivateThreads,
        PermissionFlagsBits.CreatePublicThreads,
      ],
    },
    {
      id: roleNITeam.id,
      allow: [PermissionFlagsBits.ViewChannel],
    },
  ]);
}

module.exports = { archive_channel };
