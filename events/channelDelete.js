const {InteractionType} = require(`discord.js`);
const dbHelper = require(`../helperFiles/database_functions.js`);
const validationHelper = require(`../helperFiles/validation_functions.js`);
module.exports = {
	name: `channelDelete`,
	async execute(channel) {
		let subscriptions = await dbHelper.getGuildSubsTableEntry(channel.client, channel.guildId);

		if (subscriptions){
			const streamers = JSON.parse(subscriptions.get(`streamersInfo`));
			let streamerChannels = streamers.channelIds;
			let streamerIds = streamers.streamerIds;
			let streamerNames = streamers.streamerUserNames;
			let streamerDisplayNames = streamers.streamerDisplayNames;
			let customMessages = streamers.customMessages;
			let customImages = streamers.customImages;
			let streamerWebsites = streamers.streamerWebsites;

			let initialSubscriptions = subscriptions.get(`numStreamers`);
			let twitchStreamerEntry = null;

			for(i = 0; i < streamerNames.length; i++) {
				if (channel.id == streamerChannels[i]) {
					twitchStreamerEntry = await validationHelper.checkTwitchStreamerExistsLocal(channel.client, streamerNames[i]);
					await dbHelper.deleteFollowerFromTwitchStreamer(channel.client, twitchStreamerEntry, streamerIds[i], channel.id);
					streamerChannels.splice(i,1);
					streamerIds.splice(i,1);
					streamerNames.splice(i,1);
					streamerDisplayNames.splice(i,1);
					customMessages.splice(i,1);
					customImages.splice(i,1);
					streamerWebsites.splice(i,1);
					i--;
				}
			}
			
			if(streamerNames.length == 0) {
				await subscriptions.destroy();
			} else if(initialSubscriptions != streamerNames.length) {
				const streamersStringified = JSON.stringify({ "channelIds" : streamerChannels, "streamerIds" : streamerIds, "streamerUserNames" : streamerNames, "streamerDisplayNames" : streamerDisplayNames, "customMessages" : customMessages, "customImages" : customImages, "streamerWebsites" : streamerWebsites});
				await subcriptions.update({streamersInfo: streamersStringified, numStreamers : streamerNames.length});
			}
		}
	}
};

