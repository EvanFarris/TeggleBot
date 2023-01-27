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
		.setColor(`#474354`)
		.setTitle(title)
		.setDescription(description);
	return embeddedMessage;
}


async function createEmbedComplicated(streamerUsername, streamerDisplayName, streamerDescription, streamerIcon) {
	const embeddedMessage = new EmbedBuilder()
		.setColor(`#474354`)
		.setTitle(`Retrieved ${streamerDisplayName}`)
		.setDescription(`Is this the correct streamer?`);

	if(streamerDescription == "") {streamerDescription = " ";}
	embeddedMessage.setTitle(`Is this the correct streamer? (${streamerDisplayName})`)
		.setImage(streamerIcon)
		.setURL(`https://twitch.tv/${streamerUsername}`);
	if(streamerDescription){
		embeddedMessage.setDescription(streamerDescription);
	}

	return embeddedMessage;
}

//Creates the embed for live stream notifications. 
async function createLiveStreamEmbed(client, streamEvent, streamerIcon) {
	const lsEmbed = new EmbedBuilder()
		.setColor(`#474354`)
		.setTitle(`${streamEvent.broadcasterName}'s stream`)
		.setURL(`https://twitch.tv/${streamEvent.broadcasterName}`)
		.setAuthor({name: streamEvent.broadcasterDisplayName, icon: streamerIcon})
		.setTimestamp();
	
	let liveStream = null;
	let maxAttempts = 5;
	let vod = null;
	let vodFilter = {period: `day`, type: `archive`, first: 1};
	while((!liveStream || !vod) && maxAttempts > 0) {
		if(!liveStream){
			liveStream = await client.twitchAPI.streams.getStreamByUserId(`${streamEvent.broadcasterId}`);
		}
		if(!vod){
			vod = await client.twitchAPI.videos.getVideosByUser(streamEvent.broadcasterId, vodFilter);
		}
		if(!liveStream || !vod){
			await sleep(5000);
			maxAttempts--;
		}
	}

	try{
		if(liveStream) {
			lsEmbed.setTitle(liveStream.title);
			if(liveStream.gameName){
				lsEmbed.addFields({name: `Game`, value: liveStream.gameName, inline: true});
			}
		}
		if(vod) {
			const vodObject = (vod.data)[0];
			const currentTime = Date.now();
			const vodCreationTime = new Date(vodObject.creationDate);

			if(currentTime - vodCreationTime < 1000 * 60 * 3) {
				lsEmbed.addFields({name: `Link to VOD`, value: `[Click here](${vodObject.url})`, inline: true});
			}
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
	let names = jsonParsed.streamerUserNames;
	let websites = jsonParsed.streamerWebsites;
	let channels = jsonParsed.channelIds;
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
		.setColor(`#474354`)
		.setTitle(`Streamers that ${guildName} is following`)
		.setDescription(`You are following ${numStreamers} streamers.`);
		
		if(guildIcon != null) {
			embeddedMessage.setThumbnail(`${guildIcon}`);
		}
		
		if(numStreamers == 0) {
			embeddedMessage.setDescription(`You are not following anyone.`);
		}

		for(i = 0; i < numStreamers; i++) {
			if(twitchStreamerCustomMessages[i] == ""){
				embeddedMessage.addFields({name: twitchStreamerNames[i], value: `No custom message set.`});
			} else {
				embeddedMessage.addFields({name: twitchStreamerNames[i], value: twitchStreamerCustomMessages[i]});
			}
		}

		return embeddedMessage;
}