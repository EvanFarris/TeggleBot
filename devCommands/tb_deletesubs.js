const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_deletesubs')
		.setDescription('Deletes all subscriptions'),
	async execute(interaction) {
		console.log("Deleting all eventsub subscriptions");
		await interaction.client.twitchAPI.eventSub.deleteAllSubscriptions();
		interaction.client.dbs.guildsubs.sync({force: true});
		interaction.client.dbs.twitchstreamers.sync({force: true});
		interaction.client.dbs.temp.sync({force: true});
		interaction.client.hmap.clear();
		interaction.reply("Completed.");
	},
	
};