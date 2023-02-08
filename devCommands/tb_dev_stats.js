const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_dev_stats')
		.setDescription('See information on maps/sets for debug purposes.'),
	async execute(interaction) {
		const client = interaction.client;
		let message = `\nmapChangesToBeSize: ${client.mapChangesToBe.size}\nhmap size: ${client.hmap.size}\nguildSet size: ${client.guildSet.size}\n`;
		message += `Number of rows in twitchstreamers: ${(await interaction.client.dbs.twitchstreamers.findAll()).length}\n`;
		message += `Number of rows in guildsubs: ${(await interaction.client.dbs.guildsubs.findAll()).length}\n`;
		message += `Number of rows in temp: ${(await interaction.client.dbs.temp.findAll()).length}\n`;
		message += `Number of rows in streamtemp: ${(await interaction.client.dbs.streamtemp.findAll()).length}\n`;
		interaction.reply(message);
	},
};