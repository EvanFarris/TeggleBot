const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const embeddedTitle = `TeggleBot Subscribe Results`;
module.exports = {
	createEmbed,
	createEmbedComplicated,
	createLiveStreamEmbed,
	getSelectMenu,
	decomposeSelected,
	createEmbedWithButtons,
	sleep,
	createFollowingEmbed
}


function createEmbed(title, description) {
	const embeddedMessage = new EmbedBuilder()
		.setColor(`#0099ff`)
		.setTitle(title)
		.setDescription(description);
	return embeddedMessage;
}


async function createEmbedComplicated(streamerUsername, streamerDisplayName, streamerDescription, streamerIcon) {
	const embeddedMessage = new EmbedBuilder()
		.setColor(`#0099ff`)
		.setTitle(`Retrieved ${streamerDisplayName} from Twitch.tv's API`)
		.setDescription(`Is this the correct streamer?`);

	if(streamerDescription == "") {streamerDescription = " ";}
	embeddedMessage.setTitle(`Is this the correct streamer? (${streamerDisplayName})`)
		.setImage(streamerIcon)
		.setURL(`https://twitch.tv/${streamerUsername}`)
		.setDescription(streamerDescription);

	return embeddedMessage;
}

//Creates the embed for live stream notifications. 
async function createLiveStreamEmbed(client, streamEvent, streamerIcon) {
	let liveStream = null;
	const lsEmbed = new EmbedBuilder()
		.setColor(`#0099ff`)
		.setTitle(`${streamEvent.broadcasterName}'s stream`)
		.setDescription(`No game selected...`)
		.setURL(`https://twitch.tv/${streamEvent.broadcasterName}`)
		.setAuthor({name: streamEvent.broadcasterDisplayName , iconURL: streamerIcon})
		.setTimestamp()
		.setImage(`https://static-cdn.jtvnw.net/previews-ttv/live_user_${streamEvent.broadcasterName}-320x180.jpg?r=${Date.now()}`)
		.addFields({name: `Link to VOD (If it exists)`, value: `[Click here](https://twitch.tv/videos/${streamEvent.id})`});
	let maxAttempts = 5;
	while(!liveStream && maxAttempts > 0) {
		liveStream = await client.twitchAPI.streams.getStreamByUserId(`${streamEvent.broadcasterId}`);
		if(!liveStream){
			await sleep(5000);
			maxAttempts--;
		}
	}
	try{
		if(liveStream) {
			lsEmbed.setTitle(liveStream.title);
			if(liveStream.gameName){lsEmbed.setDescription(liveStream.gameName);}
		}
	} catch(error) {
		console.log(`~~createLiveStreamEmbed~~\n${error}`);
	}
	
	return lsEmbed;
}

async function sleep(milliseconds) {
	let currentTime = Date.now();
	const stopTime = currentTime + milliseconds;
	
	while(currentTime < stopTime){
		currentTime = Date.now();
	}
}

function getSelectMenu(gs_tableEntry, customId) {
	let jsonParsed = JSON.parse(gs_tableEntry.get(`streamersInfo`));
	let names = jsonParsed.names;
	let websites = jsonParsed.websites;
	let channels = jsonParsed.channels;
	let streamerIds = jsonParsed.streamerIds;

	let selectMenuOptions = new StringSelectMenuBuilder()
		.setCustomId(customId)
		.setPlaceholder(`Nothing Selected`);
	selectMenuOptions.addOptions({label: `No one`, value: `none`});
	for(i = 0; i < names.length; i++) {
		selectMenuOptions.addOptions(
		{
			label: `${names[i]} | ${websites[i]}`,
			value: `${streamerIds[i]}|${channels[i]}|${names[i]}|${websites[i]}`
		});

	}
	return (new ActionRowBuilder().addComponents(selectMenuOptions));
}

function decomposeSelected(selectedValue) {
	let pipeIndexes = selectedValue.split(`|`);
	let streamerId = pipeIndexes[0];
	let channelId = pipeIndexes[1];
	let streamerUsername = pipeIndexes[2];
	let website = pipeIndexes[3];
	return {streamerUsername, website, streamerId, channelId};
}

//Create the embed with the help of embedHelper.
async function createEmbedWithButtons(interaction, streamerUsername, streamerDisplayName, website, streamerDescription, streamerIcon) {
	const actionRow = new ActionRowBuilder()
		.addComponents(
				new ButtonBuilder()
					.setCustomId('follow_yes')
					.setLabel(`Yes (Follow)`)
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(`follow_no`)
					.setLabel(`No`)
					.setStyle(ButtonStyle.Secondary),
		);
	let embedToSend = await createEmbedComplicated(streamerUsername, streamerDisplayName, streamerDescription, streamerIcon);
	return { actionRow, embedToSend };
}

function createFollowingEmbed(twitchStreamerNames, twitchStreamerCustomMessages, guildName, guildIcon, numStreamers) {
	const embeddedMessage = new EmbedBuilder()
		.setColor(`#0099ff`)
		.setTitle(`Streamers that ${guildName} is subscribed to (/following)`)
		.setDescription(`You are subscribed to ${numStreamers} streamers.`);
		
		if(guildIcon != null) {
			embeddedMessage.setThumbnail(`${guildIcon}`);
		}
		
		if(numStreamers == 0) {
			embeddedMessage.setDescription(`You are not subscribed to anyone.`);
		}

		for(i = 0; i < numStreamers; i++) {
			embeddedMessage.addFields({name: twitchStreamerNames[i], value: twitchStreamerCustomMessages[i]});
		}

		return embeddedMessage;
}