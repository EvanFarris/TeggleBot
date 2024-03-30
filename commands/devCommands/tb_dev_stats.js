const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_dev_stats')
		.setDescription('See information on maps/sets for debug purposes.'),
	async execute(interaction) {
		const client = interaction.client;
		let message = `\nmapChangesToBeSize: ${client.mapChangesToBe.size}\nhmap size: ${client.hmap.size}\nguildSet size: ${client.guildSet.size}\ndomains size: ${client.domains.size}\nmangatemp size: ${client.mangatemp.size}\n`;
		message += `Number of streamers being watched: ${(await interaction.client.dbs.twitchstreamers.findAll()).length}\n`;
		message += `Number of guilds that are following streamers: ${(await interaction.client.dbs.guildsubs.findAll()).length}\n`;
		message += `Number of command info waiting in temp: ${(await interaction.client.dbs.temp.findAll()).length}\n`;
		message += `Number of streamers waiting in streamtemp: ${(await interaction.client.dbs.streamtemp.findAll()).length}\n`;
		message += `Number of guilds that are following manga: ${(await interaction.client.dbs.mangaguildsubs.findAll()).length}\n`;
		message += `Number of manga domains: ${(await interaction.client.dbs.mangadomains.findAll()).length}\n`;
		message += `Number of manga series: ${(await interaction.client.dbs.mangaseries.findAll()).length}\n`;
		interaction.reply(message);
	},
};