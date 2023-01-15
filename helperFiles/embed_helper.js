const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const embeddedTitle = `TeggleBot Subscribe Results`;
module.exports = {
	createEmbed,
	createEmbedComplicated,
	createLiveStreamEmbed
}


function createEmbed(title, description) {
	const embeddedMessage = new EmbedBuilder()
		.setColor(`#0099ff`)
		.setTitle(title)
		.setDescription(description);
	return embeddedMessage;
}


async function createEmbedComplicated(streamerUsername, website, streamerDisplayName, streamerDescription, streamerIcon) {
	const embeddedMessage = new EmbedBuilder()
		.setColor(`#0099ff`)
		.setTitle(`Retrieved ${streamerDisplayName} from the ${website} API`)
		.setDescription(`Is this the correct streamer?`);

	if(website == "twitch") {
		if(streamerDescription == "") {streamerDescription = " ";}
		embeddedMessage.setTitle(`Is this the correct streamer? (${streamerUsername})`)
			.setImage(streamerIcon)
			.setURL(`https://twitch.tv/${streamerUsername}`)
			.setDescription(streamerDescription);
	} 

	return embeddedMessage;
}

async function createLiveStreamEmbed(client, streamEvent, streamerIcon) {
	let liveStream = await client.twitchAPI.streams.getStreamByUserId(`${streamEvent.broadcasterId}`);
	const lsEmbed = new EmbedBuilder()
		.setColor(`#0099ff`)
		.setTitle(`Stream Title`)
		.setDescription(`Stream Description`)
		.setURL(`https://twitch.tv/${streamEvent.broadcasterName}`)
		.setAuthor({name: streamEvent.broadcasterDisplayName , iconURL: streamerIcon})
		.setTimestamp();
	try{
		lsEmbed.setTitle(liveStream.title)
			.setDescription(liveStream.gameName)
			.setImage(liveStream.getThumbnailUrl(320, 180));
	} catch(error) {
		console.log(`~~createLiveStreamEmbed~~\n${error}`);
	}
	
	return lsEmbed;
}

