const { SlashCommandBuilder } = require('discord.js');
const embedHelper = require(`../../helperFiles/embed_functions.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('check_id')
		.setDescription(`Get your guild Id and the current channel ID`),
	async execute(interaction) {
		const information = `Guild Id: ${interaction.guildId}\nChannel Id: ${interaction.channelId}`;
		const embed = embedHelper.createEmbed(`CheckId results`, information);
		interaction.reply({embeds: [embed], ephemeral: true});
	},
	
};