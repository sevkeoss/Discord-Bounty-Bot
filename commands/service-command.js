const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");
const Discord = require("discord.js");
const { Service, active_services } = require("../_utils/service");
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

async function setup_service_command(client) {
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
    let activeService = active_services.get(key);

    switch (command) {
      case "startService":
        // check if person who clicked is the person who requested the trade
        if (interaction.user.id === activeService.lister.id) {
          // create channel and add both users to it
          // channel should be under the category of the "active trades" channel
          // get active trades channel category by name match

          let active_services_category = await GetActiveServicesCategory(
            all_categories,
            interaction.guild,
            POSITION_LENGTH
          );

          // deny everyone from seeing inside
          const channel = await interaction.guild.channels.create({
            name: `${activeService.lister.username}-${activeService.hunter.username}-service${activeService.service_number}`,
            type: 0,
            parent: active_services_category,
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
                id: activeService.lister.id,
                allow: [PermissionFlagsBits.ViewChannel],
              },
              {
                id: activeService.hunter.id,
                allow: [PermissionFlagsBits.ViewChannel],
              },
            ],
          });
          activeService.channel = channel;
          console.log(
            `[${TimeFormat.format(new Date())}]`,
            "Created new channel",
            channel.name
          );

          // send message alerting both users to the channel and request for confirmation by partner
          let content = `${activeService.lister} has initiated a service request with you ${activeService.hunter} for service ${activeService.service_number}. \n\nPlease accept or deny by clicking the buttons below. \n\nNote: all messages in service channels will be logged and can be used as evidence in the event of a dispute. \n\nWARNING: Scammers will try to impersonate other users through DMs. For that reason, all services are to be conducted within this server. Please be careful when interacting with someone you don't know. If you are unsure, please ask a moderator for help.`;
          await channel.send({
            content: content,
            components: [
              new Discord.ActionRowBuilder().addComponents(
                new Discord.ButtonBuilder()
                  .setCustomId(`confirmService-${key}`)
                  .setLabel("Accept")
                  .setStyle(ButtonStyle.Success),
                new Discord.ButtonBuilder()
                  .setCustomId(`cancelService-${key}`)
                  .setLabel("Deny")
                  .setStyle(ButtonStyle.Danger)
              ),
            ],
          });

          content = `service request sent to ${activeService.hunter}. \n\nWARNING: Scammers will try to impersonate other users through DMs. For that reason, all services are to be conducted within this server. Please be careful when interacting with someone you don't know. If you are unsure, please ask a moderator for help.`;
          await interaction.update({
            content: content,
            components: [],
          });
        } else {
          console.log(
            `Id is different. Expected ${activeService.lister.id} but got ${interaction.user.id}`
          );
        }
        break;
      case "confirmService":
        // check if person who clicked is the person who requested the trade
        if (interaction.user.id === activeService.hunter.id) {
          activeService.hunter_accepted = true;

          await interaction
            .update({
              components: [],
            })
            .catch((_) => null);

          const content = `Hello ${activeService.lister} and ${activeService.hunter}, your service transaction will be handled by an NI Team member. \n\n Steps\n1. An NI Team member will post a TAO address for the lister to send to.\n2. Once paid, the service is officially activated and the NI Team member will ask the hunter to begin work on the service.\n3. Once service has been completed and verified by the service lister, the NI Team member will send the TAO to the service hunter.\n\nPlease note that both listers and hunters are required to pay a 7.5% platform fee, which totals to 15%. Listers, please remember to include an extra 0.001 TAO to cover the transaction fee.`;
          await interaction.channel.send({
            content: content,
            components: [
              new Discord.ActionRowBuilder().addComponents(
                new Discord.ButtonBuilder()
                  .setCustomId(`completeService-${key}`)
                  .setLabel("Complete Service")
                  .setStyle(ButtonStyle.Success)
              ),
            ],
          });

          const roleNITeam = interaction.guild.roles.cache.find(
            (role) => role.name === config.team_role_name
          );
          await activeService.channel.permissionOverwrites.create(roleNITeam, {
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
              ids.map((id) => activeService.addMiddlePerson(id));
            });
        } else {
          interaction.reply({
            content: "Only the service hunter can accept the service listing.",
            ephemeral: true,
          });
        }
        break;
      case "completeService":
        // ensure user is part of NI Team
        if (activeService.hasMiddlePerson(interaction.user.id)) {
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
              content: "Service Complete. Archiving...",
            })
            .catch((_) => null);

          archive_channel(interaction, activeService, "Service");
          active_services.delete(key);
        } else {
          await interaction.reply({
            content: "Only members of the NI Team can complete the service.",
            ephemeral: true,
          });
        }
        break;
      case "cancelService":
        // check if person who clicked is the person who requested the trade
        let cancel_party;
        if (
          !!activeService &&
          interaction.user.id === activeService.lister.id
        ) {
          cancel_party = "lister";
        }

        const declined_content = `service has been declined by ${
          !!activeService
            ? cancel_party == "lister"
              ? activeService.lister
              : activeService.hunter
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

        archive_channel(interaction, activeService, "Service");
        active_services.delete(key);
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

async function GetActiveServicesCategory(
  all_categories,
  guild,
  POSITION_LENGTH
) {
  const ChannelName = config.active_services_category;
  let active_services_category = await CreateChannelCategory({
    all_categories,
    ChannelName,
    guild,
    positionLength: POSITION_LENGTH,
  });
  return active_services_category;
}

async function GetArchivesCategory(all_categories, guild, POSITION_LENGTH) {
  const ChannelName = config.archives_category;
  let active_services_category = await CreateChannelCategory({
    all_categories,
    ChannelName,
    guild,
    positionLength: POSITION_LENGTH,
  });
  return active_services_category;
}

const data = new SlashCommandBuilder()
  .setName("service")
  .setDescription(
    "Creates a service channel with lister, hunter, and middlemen."
  )
  .addUserOption((option) =>
    option
      .setName("hunter")
      .setDescription("Who is the chosen service hunter?")
      .setRequired(true)
  )
  .addNumberOption((option) =>
    option
      .setName("service-number")
      .setDescription("Which service is this for?")
      .setRequired(true)
  );

async function execute(interaction) {
  // generate random 8 character string
  const service_id = Math.random().toString(36).substring(2, 10);
  const hunter = interaction.options.getUser("hunter");

  // verify partner is not self, or bot
  if (hunter.id === interaction.user.id) {
    return interaction.reply({
      content: "You cannot list a service with yourself.",
      ephemeral: true,
    });
  } else if (hunter.bot) {
    return interaction.reply({
      content: "You cannot list a service with a bot.",
      ephemeral: true,
    });
  }

  const service_number = interaction.options.getNumber("service-number");

  // ensure amount is valid
  if (service_number <= 0) {
    return interaction.reply({
      content: "You must specify a valid service number.",
      ephemeral: true,
    });
  }

  const actionrow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`startService-${service_id}`)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success)
  );

  active_services.set(
    service_id,
    new Service(interaction.user, hunter, service_number, service_id)
  );

  content = `You want to create a service with ${hunter} for service ${service_number}?`;
  return interaction
    .reply({
      content: content,
      components: [actionrow],
      ephemeral: true,
    })
    .then(() => {
      console.log("Posted service request.");
    });
}

module.exports = {
  setup_service_command,
  data,
  execute,
};
