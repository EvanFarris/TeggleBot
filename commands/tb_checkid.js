const { SlashCommandBuilder } = require('discord.js');
const embedHelper = require(`../helperFiles/embed_helper.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_checkid')
		.setDescription(`Get your guild Id and the current channel ID`),
	async execute(interaction) {
		const information = `Guild Id: ${interaction.guildId}\nChannel Id: ${interaction.channelId}`;
		const embed = embedHelper.createEmbed(`CheckId results`, information);
		interaction.reply({embeds: [embed]});
	},
	
};