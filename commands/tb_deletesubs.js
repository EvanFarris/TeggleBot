const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_deletesubs')
		.setDescription('Deletes all subscriptions'),
	async execute(interaction) {
		await interaction.client.twitchAPI.eventSub.deleteAllSubscriptions();
	},
	
};