async function CreateChannelCategory({
  all_categories,
  ChannelName,
  guild,
  positionLength,
  permissionOverwrites,
}) {
  let active_bounties_category = all_categories.find(
    (category) => category.name.toLowerCase() === ChannelName.toLowerCase()
  );
  if (!active_bounties_category) {
    // create category in last position
    active_bounties_category = await guild.channels.create({
      name: ChannelName,
      type: 4,
      // only allow middlepersons to see this
      permissionOverwrites: permissionOverwrites,
    });
    await active_bounties_category.setPosition(positionLength);
  }
  return active_bounties_category;
}
exports.CreateChannelCategory = CreateChannelCategory;
