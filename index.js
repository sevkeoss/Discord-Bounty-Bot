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
const { config } = require("./_utils/config");
const { setup_bounty_command } = require("./commands/bounty-command");
const { setup_service_command } = require("./commands/service-command");

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

  setup_commands(client);

  client.login(config.token);
}

async function setup_commands(client) {
  await setup_bounty_command(client);
  await setup_service_command(client);
}
start();
