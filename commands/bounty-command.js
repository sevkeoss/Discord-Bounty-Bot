const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { Bounty, active_bounties } = require("../_utils/bounty");

module.exports = {
  data: new SlashCommandBuilder()
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
    ),
  async execute(interaction) {
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
  },
};
