/**
 *  MIDDLE MAN DISCORD ORGANIZER
 *
 *  Will create new tickets when users request a middleperson in a mod channel
 *
 *  Middleperson accepts which creates a channel in which only that middleperson and traders can see
 */

// invite: https://discord.com/api/oauth2/authorize?client_id=1025021163904172043&permissions=76880&scope=bot%20applications.commands

const { GatewayIntentBits } = require("discord.js");
const Discord = require("discord.js");
require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { CreateChannelCategory } = require("./_helpers/CreateChannelCategory");
const { active_bounties } = require("./_utils/active-bounties");
const { PermissionFlagsBits } = require("discord.js");
const { ButtonStyle } = require("discord.js");
const { config } = require("./_utils/config");

const TimeFormat = new Intl.DateTimeFormat("en-US", {
  // no year
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hour12: true,
});
async function start() {
  // with valid intents
  const client = new Discord.Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildMembers,
    ],
  });

  client.commands = new Discord.Collection();
  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Set a new item in the Collection
    // With the key as the command name and the value as the exported module
    client.commands.set(command.data.name, command);
  }

  client.on("ready", async (client) => {
    console.log("I am ready as", client.user.tag);
    await Promise.all(
      client.commands.map((command) => {
        return client.application.commands.create(command.data);
      })
    );
  });

  // Handle Button Interactions
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    const ID_PARTS = interaction.customId.split("-");
    let command = ID_PARTS[0];
    const key = ID_PARTS[1];
    const all_categories = interaction.guild.channels.cache.filter(
      (channel) => channel.type === 4
    );
    const POSITION_LENGTH = all_categories.size;
    let activeBounty = active_bounties.get(key);

    switch (command) {
      case "startBounty":
        // check if person who clicked is the person who requested the trade
        if (interaction.user.id === activeBounty.lister.id) {
          // create channel and add both users to it
          // channel should be under the category of the "active trades" channel
          // get active trades channel category by name match

          let active_bounties_category = await GetActiveBountiesCategory(
            all_categories,
            interaction.guild,
            POSITION_LENGTH
          );

          // deny everyone from seeing inside
          const channel = await interaction.guild.channels.create({
            name: `${activeBounty.lister.username}-${activeBounty.hunter.username}-${key}`,
            type: 0,
            parent: active_bounties_category,
            permissionOverwrites: [
              {
                id: interaction.guild.roles.everyone,
                deny: [PermissionFlagsBits.ViewChannel],
              },
              {
                // add self/bot
                id: client.user.id,
                allow: [PermissionFlagsBits.ViewChannel],
              },
              {
                id: activeBounty.lister.id,
                allow: [PermissionFlagsBits.ViewChannel],
              },
              {
                id: activeBounty.hunter.id,
                allow: [PermissionFlagsBits.ViewChannel],
              },
            ],
          });
          activeBounty.channel = channel;
          console.log(
            `[${TimeFormat.format(new Date())}]`,
            "Created new channel",
            channel.name
          );

          // send message alerting both users to the channel and request for confirmation by partner
          const content = `${activeBounty.lister.username} has initiated a bounty request with you ${activeBounty.hunter.username} and is offering a reward of ${activeBounty.amount} TAO. \n\nPlease confirm or cancel by clicking the buttons below.`;
          await channel.send({
            content: content,
            components: [
              new Discord.ActionRowBuilder().addComponents(
                new Discord.ButtonBuilder()
                  .setCustomId(`confirmBounty-${key}`)
                  .setLabel("Accept")
                  .setStyle(ButtonStyle.Success)
              ),
              new Discord.ActionRowBuilder().addComponents(
                new Discord.ButtonBuilder()
                  .setCustomId(`cancelBounty-${key}`)
                  .setLabel("Deny")
                  .setStyle(ButtonStyle.Danger)
              ),
            ],
          });

          await interaction.update({
            content: `Bounty request sent to ${activeBounty.hunter}`,
            components: [],
          });
        }
        break;
      case "confirmBounty":
        // check if person who clicked is the person who requested the trade
        if (interaction.user.id === activeBounty.hunter.id) {
          activeBounty.hunter_accepted = true;

          await interaction
            .update({
              components: [],
            })
            .catch((_) => null);

          await interaction.channel.send({
            content: `Bounty accepted! Adding NI team to channel`,
            components: [
              new Discord.ActionRowBuilder().addComponents(
                new Discord.ButtonBuilder()
                  .setCustomId(`completeBounty-${key}`)
                  .setLabel("Complete Bounty")
                  .setStyle(ButtonStyle.Success)
              ),
            ],
          });

          const roleNITeam = interaction.guild.roles.cache.find(
            (role) => role.name === "NI Team"
          );
          await activeBounty.channel.permissionOverwrites.create(roleNITeam, {
            ViewChannel: true,
          });

          await interaction.guild.members
            .fetch()
            .then((members) => {
              // Filter members who have the specified role
              const membersWithRole = members.filter((member) =>
                member.roles.cache.has(roleNITeam.id)
              );

              // Get user IDs of members with the role
              const memberIDs = membersWithRole.map((member) => member.user.id);

              return memberIDs;
            })
            .then((ids) => {
              ids.map((id) => activeBounty.addMiddlePerson(id));
            });
        } else {
          interaction.reply({
            content: "Only the bounty hunter can accept the bounty listing.",
            ephemeral: true,
          });
        }
        break;
      case "completeBounty":
        // ensure user is part of NI Team
        if (activeBounty.hasMiddlePerson(interaction.user.id)) {
          await GetArchivesCategory(
            all_categories,
            interaction.guild,
            POSITION_LENGTH
          );

          const parsedChannel = interaction.guild.channels.cache.find(
            (channel) => channel.name === "Archives"
          );

          await interaction
            .update({
              components: [],
            })
            .catch((_) => null);

          await interaction.channel.send({
            content: "Bounty Archived",
            components: [],
          });

          await activeBounty.channel.setParent(parsedChannel.id);

          const roleNITeam = interaction.guild.roles.cache.find(
            (role) => role.name === "NI Team"
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

          active_bounties.delete(key);
        } else {
          await interaction.reply({
            content: "Only members of the NI Team can complete this bounty.",
            ephemeral: true,
          });
        }
        break;
      case "cancelBounty":
        // check if person who clicked is the person who requested the trade
        let cancel_party;
        if (!!activeBounty && interaction.user.id === activeBounty.lister.id) {
          console.log("Initial party backed out of trade");

          // TODO: make a way to log the back out of this trade and tie it to the user
          cancel_party = "lister";
        }

        const content = `Trade has been terminated by ${
          !!activeBounty
            ? cancel_party == "lister"
              ? activeBounty.lister
              : activeBounty.hunter
            : "system reset"
        }.\nDeleting channel one minute from now...`;

        // remove buttons from message
        await interaction.channel.send({
          content: content,
          components: [],
        });
        const TRADE_CHANNEL = interaction.channel;

        setTimeout(async () => {
          await TRADE_CHANNEL.delete()
            .then(() => active_bounties.delete(key))
            .catch((_) => {
              console.log(
                "Failed to delete channel. It might already deleted.",
                TRADE_CHANNEL.name,
                TRADE_CHANNEL.id
              );
            });
        }, 60000);
        return;
    }
  });

  // Handle Commands
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  });

  client.login(config.token);
}

start();
async function GetActiveBountiesCategory(
  all_categories,
  guild,
  POSITION_LENGTH
) {
  const ChannelName = "Active Bounties";
  let active_bounties_category = await CreateChannelCategory({
    all_categories,
    ChannelName,
    guild,
    positionLength: POSITION_LENGTH,
  });
  return active_bounties_category;
}

async function GetArchivesCategory(all_categories, guild, POSITION_LENGTH) {
  const ChannelName = "Archives";
  let active_bounties_category = await CreateChannelCategory({
    all_categories,
    ChannelName,
    guild,
    positionLength: POSITION_LENGTH,
  });
  return active_bounties_category;
}