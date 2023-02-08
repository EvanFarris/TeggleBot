const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_dev_deleteallsubs')
		.setDescription('Deletes all subscriptions'),
	async execute(interaction) {
		console.log("Deleting all eventsub subscriptions");
		await interaction.client.twitchAPI.eventSub.deleteAllSubscriptions();
		interaction.client.dbs.guildsubs.sync({force: true});
		interaction.client.dbs.twitchstreamers.sync({force: true});
		interaction.client.dbs.temp.sync({force: true});
		inteaction.client.dbs.streamtemp.sync({force:true});
		interaction.client.hmap.clear();
		interaction.client.mapChangesToBe.clear();
		interaction.client.guildSet.clear();
		interaction.reply("Completed.");
	},
	
};