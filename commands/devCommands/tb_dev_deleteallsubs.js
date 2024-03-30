const { SlashCommandBuilder } = require('discord.js');
const dbHelper = require(`../../helperFiles/database_functions.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_dev_deleteallsubs')
		.setDescription('Add a manga domain ')
		.addBooleanOption(option =>
			option.setName(`reset_stream_dbs`)
			.setDescription('Set this to true if you want to reset stream related databases.')
			.setRequired(true))
		.addBooleanOption(option =>
			option.setName(`reset_manga_dbs`)
			.setDescription('Set this to true if you want to reset manga related databases.')
			.setRequired(true))
		.addBooleanOption(option =>
			option.setName(`delete_all_subs`)
			.setDescription('Reset twitch subscriptions')
			.setRequired(true)),

	async execute(interaction) {
		if(interaction.options.getBoolean(`reset_stream_dbs`)){
			console.log("Deleting all eventsub subscriptions");
			await interaction.client.twitchAPI.eventSub.deleteAllSubscriptions();
			console.log("Resetting tables");
			interaction.client.dbs.guildsubs.sync({force: true});
			interaction.client.dbs.twitchstreamers.sync({force: true});
			interaction.client.dbs.temp.sync({force: true});
			interaction.client.dbs.streamtemp.sync({force:true});
			interaction.client.hmap.clear();
			interaction.client.mapChangesToBe.clear();
			interaction.client.guildSet.clear();
		}

		if (interaction.options.getBoolean(`reset_manga_dbs`)) {
			interaction.client.dbs.mangaseries.sync({force: true});
			interaction.client.dbs.mangaguildsubs.sync({force: true});
			interaction.client.mangatemp = new Map();
		}
		
		if(interaction.options.getBoolean(`deleteAllSubscriptions`)) {
			console.log("Reloading eventsub subscriptions");
			await interaction.client.twitchAPI.eventSub.deleteAllSubscriptions();
			await dbHelper.loadPreviousSubscriptions(interaction.client);
		}
		
		interaction.reply("Completed.");
	},
	
};