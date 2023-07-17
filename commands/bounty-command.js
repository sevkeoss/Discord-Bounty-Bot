const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");
const Discord = require("discord.js");
const { Bounty, active_bounties } = require("../_utils/bounty");
const { CreateChannelCategory } = require("../_helpers/CreateChannelCategory");
const { archive_channel } = require("../_helpers/archive-channel");
const { config } = require("../_utils/config");

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

async function setup_bounty_command(client) {
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
            name: `${activeBounty.lister.username}-${activeBounty.hunter.username}-bounty${activeBounty.bounty_number}`,
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
          let content = `${activeBounty.lister} has initiated a bounty request with you ${activeBounty.hunter} for bounty ${activeBounty.bounty_number}. \n\nPlease accept or deny by clicking the buttons below. \n\nNote: all messages in bounty channels will be logged and can be used as evidence in the event of a dispute. \n\nWARNING: Scammers will try to impersonate other users through DMs. For that reason, all bounties are to be conducted within this server. Please be careful when interacting with someone you don't know. If you are unsure, please ask a moderator for help.`;
          await channel.send({
            content: content,
            components: [
              new Discord.ActionRowBuilder().addComponents(
                new Discord.ButtonBuilder()
                  .setCustomId(`confirmBounty-${key}`)
                  .setLabel("Accept")
                  .setStyle(ButtonStyle.Success),
                new Discord.ButtonBuilder()
                  .setCustomId(`cancelBounty-${key}`)
                  .setLabel("Deny")
                  .setStyle(ButtonStyle.Danger)
              ),
            ],
          });

          content = `Bounty request sent to ${activeBounty.hunter}. \n\nWARNING: Scammers will try to impersonate other users through DMs. For that reason, all bounties are to be conducted within this server. Please be careful when interacting with someone you don't know. If you are unsure, please ask a moderator for help.`;
          await interaction.update({
            content: content,
            components: [],
          });
        } else {
          console.log(
            `Id is different. Expected ${activeBounty.lister.id} but got ${interaction.user.id}`
          );
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

          const content = `Hello ${activeBounty.lister} and ${activeBounty.hunter}, your bounty transaction will be handled by an NI Team member. \n\n Steps\n1. An NI Team member will post a TAO address for the lister to send to.\n2. Once paid, the bounty is officially activated and the NI Team member will ask the hunter to begin work on the bounty.\n3. Once bounty has been completed and verified by the bounty lister, the NI Team member will send the TAO to the bounty hunter.\n\nPlease note that both listers and hunters are required to pay a 7.5% platform fee, which totals to 15%. Listers, please remember to include an extra 0.001 TAO to cover the transaction fee.`;
          await interaction.channel.send({
            content: content,
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
            (role) => role.name === config.team_role_name
          );
          // await activeBounty.channel.permissionOverwrites.create(roleNITeam, {
          //   ViewChannel: true,
          // });

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

          await interaction
            .update({
              components: [],
            })
            .catch((_) => null);

          await interaction.channel
            .send({
              content: "Bounty Complete. Archiving...",
            })
            .catch((_) => null);

          archive_channel(interaction, activeBounty, "Bounty");
          active_bounties.delete(key);
        } else {
          await interaction.reply({
            content: "Only members of the NI Team can complete the bounty.",
            ephemeral: true,
          });
        }
        break;
      case "cancelBounty":
        await GetArchivesCategory(
          all_categories,
          interaction.guild,
          POSITION_LENGTH
        );

        // check if person who clicked is the person who requested the trade
        let cancel_party;
        if (!!activeBounty && interaction.user.id === activeBounty.lister.id) {
          cancel_party = "lister";
        }

        const declined_content = `Bounty has been declined by ${
          !!activeBounty
            ? cancel_party == "lister"
              ? activeBounty.lister
              : activeBounty.hunter
            : "system reset"
        }.`;

        // remove buttons from message
        await interaction
          .update({
            content: interaction.content,
            components: [],
          })
          .catch((_) => null);

        await interaction.channel
          .send({
            content: declined_content,
            components: [],
          })
          .catch((err) => console.log(err));

        archive_channel(interaction, activeBounty, "Bounty");
        active_bounties.delete(key);
        break;
    }
  });

  // Handle Commands
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command || command.data.name != data.name) return;

    try {
      await execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  });
}

async function GetActiveBountiesCategory(
  all_categories,
  guild,
  POSITION_LENGTH
) {
  const ChannelName = config.active_bounties_category;
  let active_bounties_category = await CreateChannelCategory({
    all_categories,
    ChannelName,
    guild,
    positionLength: POSITION_LENGTH,
  });
  return active_bounties_category;
}

async function GetArchivesCategory(all_categories, guild, POSITION_LENGTH) {
  const ChannelName = config.archives_category;
  let active_bounties_category = await CreateChannelCategory({
    all_categories,
    ChannelName,
    guild,
    positionLength: POSITION_LENGTH,
  });
  return active_bounties_category;
}

const data = new SlashCommandBuilder()
  .setName("bounty")
  .setDescription(
    "Creates a bounty channel with lister, hunter, and middlemen."
  )
  .addUserOption((option) =>
    option
      .setName("hunter")
      .setDescription("Who is the chosen bounty hunter?")
      .setRequired(true)
  )
  .addNumberOption((option) =>
    option
      .setName("bounty-number")
      .setDescription("Which bounty is this for?")
      .setRequired(true)
  );

async function execute(interaction) {
  // generate random 8 character string
  const bounty_id = Math.random().toString(36).substring(2, 10);
  const hunter = interaction.options.getUser("hunter");

  // verify partner is not self, or bot
  if (hunter.id === interaction.user.id) {
    return interaction.reply({
      content: "You cannot list a bounty with yourself.",
      ephemeral: true,
    });
  } else if (hunter.bot) {
    return interaction.reply({
      content: "You cannot list a bounty with a bot.",
      ephemeral: true,
    });
  }

  const bounty_number = interaction.options.getNumber("bounty-number");

  // ensure amount is valid
  if (bounty_number <= 0) {
    return interaction.reply({
      content: "You must specify a valid bounty number.",
      ephemeral: true,
    });
  }

  const actionrow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`startBounty-${bounty_id}`)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success)
  );

  active_bounties.set(
    bounty_id,
    new Bounty(interaction.user, hunter, bounty_number, bounty_id)
  );

  content = `You want to create a bounty with ${hunter} for bounty ${bounty_number}?`;
  return interaction
    .reply({
      content: content,
      components: [actionrow],
      ephemeral: true,
    })
    .then(() => {
      console.log("Posted bounty request.");
    });
}

module.exports = {
  setup_bounty_command,
  data,
  execute,
};
