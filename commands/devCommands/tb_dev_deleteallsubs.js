const { SlashCommandBuilder } = require('discord.js');
const dbHelper = require(`../../helperFiles/database_functions.js`)
module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_dev_deleteallsubs')
		.setDescription('Deletes all subscriptions')
		.addBooleanOption(option =>
			option.setName(`reset_dbs`)
			.setDescription('Set this to true if you want to reset all the databases.')
			.setRequired(true)),
	async execute(interaction) {
		console.log("Deleting all eventsub subscriptions");
		await interaction.client.twitchAPI.eventSub.deleteAllSubscriptions();
		if(interaction.options.getBoolean(`reset_dbs`)){
			console.log("Resetting tables");
			interaction.client.dbs.guildsubs.sync({force: true});
			interaction.client.dbs.twitchstreamers.sync({force: true});
			interaction.client.dbs.temp.sync({force: true});
			interaction.client.dbs.streamtemp.sync({force:true});
			interaction.client.hmap.clear();
			interaction.client.mapChangesToBe.clear();
			interaction.client.guildSet.clear();
		} else {
			await dbHelper.loadPreviousSubscriptions(interaction.client);
		}
		
		interaction.reply("Completed.");
	},
	
};