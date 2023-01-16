const {InteractionType} = require(`discord.js`);
const dbHelper = require(`../helperFiles/database_functions.js`);
const validationHelper = require(`../helperFiles/validation_functions.js`);
module.exports = {
	name: `channelDelete`,
	async execute(channel) {
		let subscriptions = await dbHelper.getGuildSubsTableEntry(channel.client, channel.guildId);

		if (subscriptions){
			const streamers = JSON.parse(subscriptions.get(`streamersInfo`));
			let streamerNames = streamers.names;
			let streamerWebsites = streamers.websites;
			let streamerChannels = streamers.channels;
			let streamerIds = streamers.streamerIds;
			let initialSubscriptions = subscriptions.get(`numStreamers`);
			let twitchStreamerEntry = null;
			for(i = 0; i < streamerNames.length; i++) {
				if (channel.id == streamerChannels[i]) {
					twitchStreamerEntry = await validationHelper.checkTwitchStreamerExistsLocal(channel.client, streamerNames[i]);
					await dbHelper.deleteFollowerFromTwitchStreamer(channel.client, twitchStreamerEntry, streamerIds[i], channel.id);
					streamerNames.splice(i,1);
					streamerWebsites.splice(i,1);
					streamerChannels.splice(i,1);
					streamerIds.splice(i,1);
					i--;
				}
			}
			
			if(streamerNames.length == 0) {
				await subscriptions.destroy();
			} else if(initialSubscriptions != streamerNames.length) {
				const streamersStringified = JSON.stringify({"names" : streamerNames, "websites" : streamerWebsites, "channels" : streamerChannels, "streamerIds" : streamerIds });
				await channel.client.dbs.guildsubs.update({streamersInfo: streamersStringified, numStreamers : streamerNames.length}, {where: {guildId: `${channel.guildId}`}});
			}
		}
	}
};

