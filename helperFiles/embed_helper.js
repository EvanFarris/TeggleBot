const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const embeddedTitle = `TeggleBot Subscribe Results`;
module.exports = {
	createEmbed,
	createEmbedComplicated,
	createLiveStreamEmbed,
	getSelectMenu,
	decomposeSelected,
	createEmbedWithButtons
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
	let liveStream = null;
	const lsEmbed = new EmbedBuilder()
		.setColor(`#0099ff`)
		.setTitle(`Stream Title`)
		.setDescription(`Stream Description`)
		.setURL(`https://twitch.tv/${streamEvent.broadcasterName}`)
		.setAuthor({name: streamEvent.broadcasterDisplayName , iconURL: streamerIcon})
		.setTimestamp();
	let maxAttempts = 5;
	while(!liveStream && maxAttempts > 0) {
		liveStream = await client.twitchAPI.streams.getStreamByUserId(`${streamEvent.broadcasterId}`);
		if(!liveStream){
			sleep(5000);
			maxAttempts--;
		}
	}
	try{
		if(liveStream) {
			lsEmbed.setTitle(liveStream.title)
				.setDescription(liveStream.gameName)
				.setImage(liveStream.getThumbnailUrl(320, 180));
		}
	} catch(error) {
		console.log(`~~createLiveStreamEmbed~~\n${error}`);
	}
	
	return lsEmbed;
}

function sleep(milliseconds) {
	const stopTime = Date.now() + milliseconds;
	let currentTime = Date.now();
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
					.setCustomId('tb_subscribe_yes')
					.setLabel(`Yes (Subscribe)`)
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(`tb_subscribe_no`)
					.setLabel(`No`)
					.setStyle(ButtonStyle.Secondary),
		);
	let replyEmbedded = await createEmbedComplicated(streamerUsername, website, streamerDisplayName, streamerDescription, streamerIcon);
	return { actionRow, replyEmbedded };
}