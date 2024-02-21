const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_dev_stats')
		.setDescription('See information on maps/sets for debug purposes.'),
	async execute(interaction) {
		const client = interaction.client;
		let message = `\nmapChangesToBeSize: ${client.mapChangesToBe.size}\nhmap size: ${client.hmap.size}\nguildSet size: ${client.guildSet.size}\n`;
		message += `Number of streamers being watched: ${(await interaction.client.dbs.twitchstreamers.findAll()).length}\n`;
		message += `Number of guilds the bot is in: ${(await interaction.client.dbs.guildsubs.findAll()).length}\n`;
		message += `Number of command info waiting in temp: ${(await interaction.client.dbs.temp.findAll()).length}\n`;
		message += `Number of streamers waiting in stremtemp: ${(await interaction.client.dbs.streamtemp.findAll()).length}\n`;
		interaction.reply(message);
	},
};