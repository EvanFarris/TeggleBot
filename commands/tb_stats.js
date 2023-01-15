const { SlashCommandBuilder } = require('discord.js');
const embedHelper = require(`../helperFiles/embed_helper.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_stats')
		.setDescription('Get some stats about the bot'),
	async execute(interaction) {
		let numGuilds = interaction.client.guilds.cache.size;
		let numStreamers = interaction.client.hmap.size;
		let title = `Tegglebot stats`;
		let message = `Tegglebot is in ${numGuilds} guilds and is following ${numStreamers} streamers`;

		let myEmbed = await embedHelper.createEmbed(title, message);
		interaction.reply({embeds: [myEmbed]});
	}
};