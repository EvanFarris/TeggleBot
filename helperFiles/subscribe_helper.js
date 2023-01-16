const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const embeddedTitle = `TeggleBot Subscribe Results`;
module.exports = {
	createEmbeddedMessage,
	createEmbeddedMessageComplicated,
	createLiveStreamEmbed
}


function createEmbeddedMessage(title, description) {
	const embeddedMessage = new EmbedBuilder()
		.setColor(`#09f`)
		.setTitle(title)
		.setDescription(description);
	return embeddedMessage;
}


async function createEmbeddedMessageComplicated(streamerUsername, website, streamerDisplayName, streamerDescription, streamerIcon, streamerId) {
	const embeddedMessage = new EmbedBuilder()
		.setColor(`#0099ff`)
		.setTitle(`Retrieved ${streamerUsername} from the ${website} API`)
		.setDescription(`Is this the correct streamer?`);

	if(website == "twitch") {
		if(streamerDescription == "") {streamerDescription = " ";}
		embeddedMessage.setTitle(`Is this the correct streamer? (${streamerUsername})`)
			.setImage(streamerIcon)
			.setURL(`https://twitch.tv/${streamerUsername}`)
			.setDescription(streamerDescription)
			.setFooter({text:`${website}|${streamerUsername}|${streamerDisplayName}|${streamerId}`});
	} else if (website == "youtube") {

	}

	return embeddedMessage;
}

//TODO: Embed fails to be made as a property is null
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

