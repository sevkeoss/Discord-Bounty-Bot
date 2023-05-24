# Discord Bounty Bot

This discord bot is intended to help facilitate the bounty platform on Discord for Neural Internet.

## Setup

1. Run `npm install` to install all necessary packages.
2. Go to `./_utils/config.js` and add your discord token.

   2.1 The discord token can be obtained by following this link: [How to get discord token](https://linuxhint.com/get-discord-token/)

## Config

The config file, [config.js](./_utils/config.js), contains values you can configure depending on your needs. The parameters that need to be specified are:

1. token: Your discord token.
2. team_role_name: The discord role name of the NI team.
3. active_bounties_category: The category to create all the bounty private text channels under.
4. archives_category: The category to store all the archived bounty text channels under.
