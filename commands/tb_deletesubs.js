const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_deletesubs')
		.setDescription('Deletes all subscriptions'),
	async execute(interaction) {
		console.log("Deleting all eventsub subscriptions");
		await interaction.client.twitchAPI.eventSub.deleteAllSubscriptions();
		interaction.reply("Completed.");
	},
	
};