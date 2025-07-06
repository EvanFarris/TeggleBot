const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType  } = require('discord.js');
const embeddedTitle = `TeggleBot Subscribe Results`;
module.exports = {
	copy,
	createEmbed,
	createEmbedWithButtons,
	createFollowingEmbed,
	createFollowingMangaEmbed,
	createLiveStreamEmbed,
	createMangaSeriesInfo,
	createNewMangaEmbed,
	decomposeSelected,
	getSelectMenu,
	startCollector,
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
async function createLiveStreamEmbed(streamEvent, streamerIcon, liveStream, vod) {
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
		if(vod) {
			lsEmbed.addFields({name: `Link to VOD`, value: `[Latest VOD](${vod.url})`, inline: true});
		}
	} catch(error) {
		console.log(`~~createLiveStreamEmbed~~\n${error}`);
	}
	
	return lsEmbed;
}

//Creates a select menu with a customId for interactionCreate to handle and route to the right command.
function getSelectMenu(gs_tableEntry, customId, gType = "streamer", startIndex = 0) {
	let selectMenuOptions = new StringSelectMenuBuilder()
			.setCustomId(customId)
			.setPlaceholder(`Nothing Selected`);
	selectMenuOptions.addOptions({label: `Do Nothing`, value: `-1`});

	if(gType == "streamer") {
		let jsonParsed = JSON.parse(gs_tableEntry.get(`streamersInfo`));
		let names = jsonParsed.streamerUserNames;
		let websites = jsonParsed.streamerWebsites;
		let channels = jsonParsed.channelIds;
		let streamerIds = jsonParsed.streamerIds;

		for(i = 0; i < names.length; i++) {
			selectMenuOptions.addOptions(
			{
				label: `${names[i]}`,
				value: `${streamerIds[i]}|${channels[i]}|${names[i]}|${websites[i]}|${gType}`
			});
		}
	} else if(gType == "manga") {
		let mangaList = JSON.parse(gs_tableEntry.get(`mangaInfo`));
		for(let i = 0; i < Math.min(23, mangaList.length - startIndex); i++) {
			selectMenuOptions.addOptions(
			{
				label: mangaList[i + startIndex].title,
				value: `${(i + startIndex).toString()}|${gType}`
			});
		}
		
		if(startIndex + 23 < mangaList.length){selectMenuOptions.addOptions({label: `Next Page`, value: `-${startIndex + 23}`});}
		else if(startIndex + 23 == mangaList.length){selectMenuOptions.addOptions({label: mangaList[startIndex+23].title, value: `${(startIndex + 23).toString()}|${gType}`});}
	} else {
		return null;
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
function createEmbedWithButtons(interaction, info, callingFn, noBtn) {
	const actionRow = new ActionRowBuilder()
		.addComponents(
				new ButtonBuilder()
					.setCustomId(callingFn)
					.setLabel(`Yes (Follow)`)
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(noBtn)
					.setLabel(`No`)
					.setStyle(ButtonStyle.Secondary),
		);
	let embedToSend = null;
	if(callingFn == "follow") {embedToSend = createCheckStreamerEmbed(info);}
	else if (callingFn == "follow_manga"){embedToSend = createCheckMangaEmbed(info);}

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
function createCheckStreamerEmbed(info) {
	const embeddedMessage = new EmbedBuilder()
		.setColor(`#474354`)
		.setTitle(`Retrieved ${info.displayname}`)
		.setDescription(`Is this the correct streamer?`);

	if(info.description == "" || info.description == "null") {info.description = null;}
	embeddedMessage.setTitle(`Is this the correct streamer? (${info.displayname})`)
		.setImage(info.icon)
		.setURL(`https://twitch.tv/${info.username}`);
	if(info.description){
		embeddedMessage.setDescription(info.description);
	}

	return embeddedMessage;
}

function createCheckMangaEmbed(info) {
	const embed = new EmbedBuilder()
		.setColor(`#474354`)
		.setTitle(`Is this the right series?`)
		.setDescription(`Series title`);
	
	if(info.title){embed.setDescription(info.title);}
	if(info.image){embed.setImage(info.image);}
	if(info.domain){embed.setURL(info.url);}

	return embed;
}

//Component collector for string select menus (unfollow.js, change_message.js)
async function startCollector(interaction, customId, messageSent, cType, dbHelper, actionRow, embedToSend, streamerUsername){
	const filter = i => i.customId == `${customId}` || i.customId.substring(0,9) == "button_no";
	const collector = messageSent.createMessageComponentCollector({ filter, componentType: cType, time: 15000 });
				
	try {
		collector.on(`collect`, collected => {
			interaction.client.guildSet.delete(interaction.guildId);
			if(cType == ComponentType.StringSelect){
				interaction.editReply({components: []});
			} else if(cType == ComponentType.Button) {
				actionRow.components[0].setDisabled(true);
				actionRow.components[1].setDisabled(true);
				interaction.editReply({ephemeral: true, embeds: [embedToSend], components: [actionRow]});

				//Clean up the temporary table's data on "No" button press
				if(i.customId == "button_no_streamer") {dbHelper.deleteTempInfo(interaction.client, interaction.guildId, streamerUsername);}
				else if(i.customId == "button_no_manga") {interaction.client.mangatemp.delete(interaction.guildId);}
			}
			
		});
		
		collector.on(`end`, collected => {
			if(collected.size == 0) {
				interaction.client.guildSet.delete(interaction.guildId);
				if(cType == ComponentType.StringSelect) {
					interaction.editReply({components: []});
					if(customId != "unfollow") {interaction.client.mapChangesToBe.delete(interaction.guildId);}
				} else if (cType == ComponentType.Button){
					if(customId == `follow`){dbHelper.deleteTempInfo(interaction.client, interaction.guildId, streamerUsername);}
					else if(customId == "button_no_manga") {interaction.client.mangatemp.delete(interaction.guildId);}
					
					actionRow.components[0].setDisabled(true);
					actionRow.components[1].setDisabled(true);
					interaction.editReply({ephemeral: true, embeds: [embedToSend], components: [actionRow]});
				}
				
			}	
		});
	} catch (error) {console.log(error);}
}

//Shortcut
function copy(embedToCopy) {
	return EmbedBuilder.from(embedToCopy);
}

function createFollowingMangaEmbed(mgs_te, guildName, guildIcon) {
	const embeddedMessage = new EmbedBuilder()
		.setColor(`#474354`)
		.setTitle(`Manga that ${guildName} is following`);
		
		if(guildIcon != null) {
			embeddedMessage.setThumbnail(`${guildIcon}`);
		}
		
		if(!mgs_te || mgs_te.numManga == 0) {
			embeddedMessage.setDescription(`You are not following any manga.`);
		} else {
			let valueMessage;
			embeddedMessage.setDescription(`You are following ${mgs_te.numManga} manga.`);
			for(const manga of JSON.parse(mgs_te.get(`mangaInfo`))) {
				valueMessage = manga.channelMessage || `No custom message set.`;
				valueMessage = `Notifications are sent to <#${manga.channelId}>\nCustom Message: ` + valueMessage;
				embeddedMessage.addFields({name: manga.title, value: valueMessage});
			}
		}

		return embeddedMessage;
}

function createNewMangaEmbed(title, url, image, diff, chapters){
	const embeddedMessage = new EmbedBuilder()
		.setColor(`#474354`)
		.setTitle(`${title.substring(0,256)}`)
		.setURL(url)
		.setThumbnail(image)
		.setTimestamp();
	if(diff > 0) {
		let desc = `${diff} chapter`;
		desc += (diff > 1 ? `s were added.` : ` was added.`);
		embeddedMessage.setDescription(desc);
		let cVal = dVal = cTemp = dTemp= '', chTitle = 'Latest Chapter', dtTitle = `Date Added`;
		for(const chapter of chapters) {
			cTemp = `[${chapter[0]}](${url}${chapter[1]})\n`;
			dTemp = `${chapter[2]}\n`
			//Discord API char limit for fields
			if((cTemp.length + cVal.length > 1024) || (dTemp.length + dVal.length > 1024)){break;}
			cVal += cTemp;
			dVal += dTemp;
		}
		if(chapters.length > 1){chTitle += 's';}
		embeddedMessage.addFields({name: chTitle, value: cVal, inline: true}, {name: dtTitle, value: dVal, inline: true});
	} else {
		let desc = `${diff * -1} chapter`;
		if(diff * -1 > 1){desc += `s were removed.`;}
		else {desc += ` was removed.`};

		embeddedMessage.setDescription(desc);
	}

	return embeddedMessage;
}

function createMangaSeriesInfo(info){
	const embeddedMessage = new EmbedBuilder()
		.setColor(`#474354`)
		.setTitle(info.title)
		.setThumbnail(info.imageUrl)
		.setTimestamp();
	let url = `https://${info.domain}/`;
	if(info.pathPrefix.length > 0){url += `${info.pathPrefix}/`;}
	url += `${info.identifier}/`;
	embeddedMessage.setURL(url);
	const chapters = JSON.parse(info.chapters);
	const maxChapters = 5;
	const firstNChapters = chapters.slice(0, Math.min(chapters.length, maxChapters));

	let chString = dtString = '', chTitle = 'Latest Chapter';
	for(const chapter of firstNChapters) {
		chString += `[${chapter[0]}](${url}${chapter[1]})\n`;
		dtString += `${chapter[2]}\n`;
	}
	if(chapters.length > 1){chTitle += 's';}
	embeddedMessage.setDescription(`Number of chapters: ${info.numChapters}`);
	embeddedMessage.addFields({name: chTitle, value: chString, inline: true}, {name: `Date Released`, value: dtString, inline: true});

	return embeddedMessage;
}
