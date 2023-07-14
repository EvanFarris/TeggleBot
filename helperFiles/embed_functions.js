const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType  } = require('discord.js');
const embeddedTitle = `TeggleBot Subscribe Results`;
module.exports = {
	createEmbed,
	createLiveStreamEmbed,
	getSelectMenu,
	decomposeSelected,
	createEmbedWithButtons,
	createFollowingEmbed,
	startCollector,
	copy
}

//Basic embed
function createEmbed(title, description) {
	const embeddedMessage = new EmbedBuilder()
		.setColor(`#474354`)
		.setTitle(title)
		.setDescription(description);
	return embeddedMessage;
}

//Creates the embed for live stream notifications. 
async function createLiveStreamEmbed(streamEvent, streamerIcon, liveStream, vodLink) {
	const lsEmbed = new EmbedBuilder()
		.setColor(`#474354`)
		.setTitle(`${streamEvent.broadcasterDisplayName}'s stream`)
		.setURL(`https://twitch.tv/${streamEvent.broadcasterName}`)
		.setAuthor({name: streamEvent.broadcasterDisplayName, iconURL: streamerIcon, url: `https://twitch.tv/${streamEvent.broadcasterName}`})
		.setTimestamp();

	//If we get livestream or vod data, add it to the embed.
	try{
		lsEmbed.addFields({name: `Stream Status`, value: `✅ Live ✅`});
		if(liveStream) {
			lsEmbed.setTitle(liveStream.title);
			if(liveStream.gameName){
				lsEmbed.addFields({name: `Game`, value: liveStream.gameName, inline: true});
			}
		}
		if(vodLink) {
			lsEmbed.addFields({name: `Link to VOD`, value: `[Latest VOD](${vodLink})`, inline: true});
		}
	} catch(error) {
		console.log(`~~createLiveStreamEmbed~~\n${error}`);
	}
	
	return lsEmbed;
}

//Creates a select menu with a customId for interactionCreate to handle and route to the right command.
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
			label: `${names[i]}`,
			value: `${streamerIds[i]}|${channels[i]}|${names[i]}|${websites[i]}`
		});

	}
	return (new ActionRowBuilder().addComponents(selectMenuOptions));
}

//Decomposes the value returned from a stringSelectMenu into usable data.
function decomposeSelected(selectedValue) {
	let pipeIndexes = selectedValue.split(`|`);
	let streamerId = pipeIndexes[0];
	let channelId = pipeIndexes[1];
	let streamerUsername = pipeIndexes[2];
	let website = pipeIndexes[3];
	return {streamerUsername, website, streamerId, channelId};
}

//Embed with buttons to be sent when following a streamer, to confirm they want to follow this particular streamer
function createEmbedWithButtons(interaction, streamerUsername, streamerDisplayName, website, streamerDescription, streamerIcon) {
	const actionRow = new ActionRowBuilder()
		.addComponents(
				new ButtonBuilder()
					.setCustomId('follow')
					.setLabel(`Yes (Follow)`)
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(`button_no`)
					.setLabel(`No`)
					.setStyle(ButtonStyle.Secondary),
		);
	let embedToSend = createCheckStreamerEmbed(streamerUsername, streamerDisplayName, streamerDescription, streamerIcon);
	return { actionRow, embedToSend };
}

//Embed to be sent when using /following command (following.js)
function createFollowingEmbed(twitchStreamerNames, twitchStreamerCustomMessages, twitchStreamerCustomImages, twitchChannelIds, guildName, guildIcon, numStreamers) {
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
		let valueMessage;
		for(i = 0; i < numStreamers; i++) {
			valueMessage = twitchStreamerCustomMessages[i] || `No custom message set.`;
			if(twitchStreamerCustomImages[i]) {valueMessage += `\n[Image](${twitchStreamerCustomImages[i]}) (Clickable if set to a valid link to a picture)`}
			else {valueMessage += `\nNo custom image set.`;}
			valueMessage = `Notifications are sent to <#${twitchChannelIds[i]}>\nCustom Message: ` + valueMessage;
			embeddedMessage.addFields({name: twitchStreamerNames[i], value: valueMessage});
		}

		return embeddedMessage;
}

//Used in /following when asking if the streamer found is the one they want to subscribe to.
function createCheckStreamerEmbed(streamerUsername, streamerDisplayName, streamerDescription, streamerIcon) {
	const embeddedMessage = new EmbedBuilder()
		.setColor(`#474354`)
		.setTitle(`Retrieved ${streamerDisplayName}`)
		.setDescription(`Is this the correct streamer?`);

	if(streamerDescription == "" || streamerDescription == "null") {streamerDescription = null;}
	embeddedMessage.setTitle(`Is this the correct streamer? (${streamerDisplayName})`)
		.setImage(streamerIcon)
		.setURL(`https://twitch.tv/${streamerUsername}`);
	if(streamerDescription){
		embeddedMessage.setDescription(streamerDescription);
	}

	return embeddedMessage;
}

//Component collector for string select menus (unfollow.js, change_message.js)
async function startCollector(interaction, customId, messageSent){
	const filter = i => i.customId == `${customId}`;
	const collector = messageSent.createMessageComponentCollector({ filter, componentType: ComponentType.StringSelect, time: 15000 });
				
	try {
		collector.on(`collect`, collected => {
			interaction.client.guildSet.delete(interaction.guildId);
			interaction.editReply({components: []});
		});
		collector.on(`end`, collected => {
			if(collected.size == 0) {
				interaction.client.guildSet.delete(interaction.guildId);
				interaction.editReply({components: []});
				if(customId != "unfollow") {interaction.client.mapChangesToBe.delete(interaction.guildId);}
			}	
		});
	} catch (error) {console.log(error);}
}

//Shortcut
function copy(embedToCopy) {
	return EmbedBuilder.from(embedToCopy);
}