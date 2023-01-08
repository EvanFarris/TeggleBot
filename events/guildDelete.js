const {InteractionType} = require(`discord.js`);
const dbHelper = require(`../helperFiles/database_functions.js`);
const validationHelper = require(`../helperFiles/validation_functions.js`);
module.exports = {
	name: `guildDelete`,
	async execute(guild) {
		try{
			let subscriptions = await dbHelper.getGuildSubsTableEntry(guild.client, guild.Id);

			if (subscriptions){
				const streamers = JSON.parse(subscriptions.get(`streamersInfo`));
				let streamerNames = streamers.names;
				let streamerIds = streamers.streamerIds;
				let streamerChannels = streamers.channels;
				let twitchStreamerEntry;
				for(i = 0; i < streamerNames.length; i++) {
					twitchStreamerEntry = await validationHelper.checkTwitchStreamerExistsLocal(guild.client, streamerNames[i]);
					await dbHelper.deleteFollowerFromTwitchStreamer(guild.client, twitchStreamerEntry, streamerIds[i], streamerChannels[i]);
				}
				
				await subscriptions.destroy();
			}
		} catch (error) {
			console.log(`~~guildDelete~~\n${error}`);
		}
		
	}
};
