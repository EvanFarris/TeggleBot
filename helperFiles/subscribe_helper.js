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


async function createEmbeddedMessageComplicated(streamerUsername, website, twitchAPI) {
	const embeddedMessage = new EmbedBuilder()
		.setColor(`#0099ff`)
		.setTitle(`Retrieved ${streamerUsername} from the ${website} API`)
		.setDescription(`Is this the correct streamer?`);

	if(website == "twitch") {
		let streamerObject = await twitchAPI.users.getUserByName(streamerUsername);
		let channelDescription = streamerObject.description;
		if(channelDescription == "") {channelDescription = " ";}
		embeddedMessage.setTitle(`Is this the correct streamer? (${streamerUsername})`)
			.setImage(streamerObject.profilePictureUrl)
			.setURL(`https://twitch.tv/${streamerUsername}`)
			.setDescription(channelDescription);
	} else if (website == "youtube") {

	}

	return embeddedMessage;
}

//TODO: Embed fails to be made as a property is null
async function createLiveStreamEmbed(streamEvent) {
	let liveStream = await streamEvent.getStream();
	let streamer = await streamEvent.getBroadcaster();
	const lsEmbed = new EmbedBuilder()
		.setColor(`#0099ff`)
		.setTitle(`${liveStream.title}`)
		.setURL(`https://twitch.tv/${streamEvent.broadcasterName}`)
		.setAuthor({name: `${liveStream.userDisplayName}` , iconURL:`${streamer.profilePictureUrl}`})
		.setDescription(`${liveStream.gameName}`)
		.setImage(`${liveStream.thumbnailUrl}`)
		.setTimestamp();
	return lsEmbed;
}

