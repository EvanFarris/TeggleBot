const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_checkid')
		.setDescription(`Get your guildID`),
	async execute(interaction) {
		await interaction.reply(`${interaction.guildId}`);
	},
	
};