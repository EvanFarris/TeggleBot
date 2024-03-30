const embedHelper = require(`./embed_functions.js`);

const maxSubscribedTo = 5;
module.exports = {
	addFollowerToGuildSubs,
	addFollowerToTwitchStreamer,
	addTempInfo,
	deleteFollowerFromGuildSubs,
	deleteFollowerFromTwitchStreamer,
	deleteTempInfo,
	getGuildSubsTableEntry,
	getMangaGuildSubsTableEntry,
	checkGuildSubs,
	getTempInfo,
	loadPreviousSubscriptions,
	updateProperty,
	addMangaDomain,
	loadPreviousManga,
	checkLocalMangaSeries,
	addUserToMangaSeries,
	createMangaSeries,
	createMangaGuildSubsTableEntry,
	addMangaToMGS,
	mangaPreChecks,
	deleteFollowerFromMangaGuildSubs,
	deleteFollowerFromMangaSeries,
	getFromMangaDbs,
	loadExemptGuilds,
	addExemptGuild,
}

//Exported Functions

async function addFollowerToGuildSubs(client, gs_tableEntry, guildId, channelId, streamerId, streamerUsername, streamerDisplayName, customMessage, customImage, website) {
	if(gs_tableEntry != null) {
		return await updateGuildSubs(client, gs_tableEntry, guildId, channelId, streamerId, streamerUsername, streamerDisplayName, customMessage, customImage, website, false);					
	} else {
		return await createGuildSubs(client, guildId, channelId, streamerId, streamerUsername, streamerDisplayName, customMessage, customImage, website);
	}
}

async function addFollowerToTwitchStreamer(client, streamerAsJSON, channelId, streamerId, streamerUsername, streamerDisplayName, streamerDescription, streamerIcon, customMessage, customImage) {
	if(streamerAsJSON != null) {
		return await updateTwitchStreamer(client, streamerAsJSON, channelId, streamerId, customMessage, customImage, false);
	} else {
		return await createTwitchStreamer(client, channelId, streamerId, streamerUsername, streamerDisplayName, streamerDescription, streamerIcon, customMessage, customImage);
	}
}

async function addTempInfo(client, guildId, channelId, streamerId, streamerUsername, streamerDisplayName, customMessage, customImage) {
	try {
		const dbEntryInserted = await client.dbs.temp.create({
			guildId: guildId,
			channelId: channelId,
			streamerId: streamerId,
			streamerUsername: streamerUsername,
			streamerDisplayName: streamerDisplayName,
			customMessage: customMessage,
			customImage: customImage
		});
	} catch(error) {
		console.log(`storeTempInfo\n${error}`);
	}
}

async function deleteFollowerFromGuildSubs(client, gs_tableEntry, guildId, streamerUsername, website) {
	return await updateGuildSubs(client, gs_tableEntry, guildId, null, null, streamerUsername, null, null, null, website, true);
}

async function deleteFollowerFromTwitchStreamer(client, streamerAsJSON, streamerId, channelId) {
	if(streamerAsJSON){
		return await updateTwitchStreamer(client, streamerAsJSON, channelId, streamerId, null, null, true);
	}
}

async function deleteTempInfo(client, guildId, streamerUsername) {
	try {
		let tempDB = await client.dbs.temp.findOne({ where: { guildId: `${guildId}`, streamerUsername: `${streamerUsername}` }});
		if(tempDB) {await tempDB.destroy();}
	} catch(error) {
		console.log(`deleteTempData\n${error}`);
	}
}

async function getGuildSubsTableEntry(client, guildId, gType = "streamer") {
	try {
		let gs_tableEntry;
		if(gType == `streamer`){gs_tableEntry = await client.dbs.guildsubs.findOne({ where: { guildId: `${guildId}` }});}
		else if (gType == `manga`) {gs_tableEntry = await client.dbs.mangaguildsubs.findOne({ where: { guildId: `${guildId}` }});}
		else {gs_tableEntry = null;}
		return gs_tableEntry;
	} catch (error) {
		console.log(`~~~~getGuildSubsTableEntry~~~~\n${error}\n`);
		return null;
	}
}

async function getTempInfo(client, guildId, streamerUsername) {
	try {
		let channelId = null, streamerId = null, streamerDisplayName = null, customMessage = null;
		let extraInfo = await client.dbs.temp.findOne({ where: { guildId: `${guildId}`, streamerUsername: `${streamerUsername}` }});
		if(extraInfo) {
			channelId = extraInfo.get(`channelId`);
			streamerId = extraInfo.get(`streamerId`);
			streamerDisplayName = extraInfo.get(`streamerDisplayName`);
			customMessage = extraInfo.get(`customMessage`);
			customImage = extraInfo.get(`customImage`);
			await extraInfo.destroy();
		}

		return { channelId, streamerId, streamerDisplayName, customMessage, customImage };
	} catch (error) {
		console.log(`getExtraSubInfo\n${error}`);
	}
}

async function checkGuildSubs(interaction, gs_tableEntry, streamerUsername, website, embeddedTitle) {
	if(gs_tableEntry) {
		let wasFound, streamerId, msg = "";
		({wasFound, streamerId} = checkIfGuildIsAlreadySubscribedToStreamer(gs_tableEntry, streamerUsername, website));

		if(wasFound) {
			msg = `You are already subscribed to this streamer.`;
		} else if (!(checkIfGuildCanSubscribeToAnotherStreamer(gs_tableEntry))) {
			msg = 'You can only have up to 5 streamers subscribed at a time.';
		}
				
		if(msg != "") {
			interaction.reply({ embeds : [embedHelper.createEmbed(embeddedTitle, msg)]});
			return false;
		}
	}
	return true;
}

async function loadPreviousSubscriptions(client) {
	let rows = await client.dbs.twitchstreamers.findAll();
	let sName, sId, obj;
	let curTime = Date.now();
	
	const cutoffTime = curTime - (1000 * 86400 * 30);
	
	for(i = 0; i < rows.length; i++) {
		obj = rows.at(i);
		sName = obj.get("streamerUsername");
		sId = obj.get("streamerId");

		await twitchEventSubSubscribe(client, sId);
		/*
		if(obj.get("lastOnline") > cutoffTime) {
			
		} else { 
			//TODO: Remove all followers from guild_subs, then remove the streamer from twitch_subs
		}*/
	}
}

async function updateProperty(client, gs_tableEntry, streamerAsJSON, guildId, channelId, streamerId, updateType, customValue) {
	let followersParsed = JSON.parse(streamerAsJSON.get(`followersInfo`));
	let streamerFollowers = followersParsed.followers;
	let customMessages = followersParsed.customMessages;
	let customImages = followersParsed.customImages;

	const streamerName = streamerAsJSON.streamerUsername;
	const streamersInfo = JSON.parse(gs_tableEntry.streamersInfo);

	const streamerChannels = streamersInfo.channelIds;
	const streamerIds = streamersInfo.streamerIds;
	const streamerNames = streamersInfo.streamerUserNames;
	const streamerDisplayNames = streamersInfo.streamerDisplayNames;
	let streamerMessages = streamersInfo.customMessages;
	let streamerImages = streamersInfo.customImages;
	const streamerWebsites = streamersInfo.streamerWebsites;
	for(i = 0; i < streamerNames.length; i++) {
		if(streamerNames[i] == streamerName) {
			if(updateType == `message`) {streamerMessages[i] = customValue;}
			else if(updateType == `image`) {streamerImages[i] = customValue;}
			else if(updateType == `channel`) {streamerChannels[i] = customValue;}
			
			let stringifiedInfo = JSON.stringify({"channelIds": streamerChannels, "streamerIds": streamerIds, "streamerUserNames": streamerNames, "streamerDisplayNames" : streamerDisplayNames, "customMessages": streamerMessages, "customImages" : streamerImages, "streamerWebsites": streamerWebsites });
			await gs_tableEntry.update({"streamersInfo" : stringifiedInfo});
			break;
		}
	}
	
	let result = false;
	for(i = 0; i < streamerFollowers.length; i++) {
		if(streamerFollowers[i] == channelId) {
			if(updateType == `message`) {customMessages[i] = customValue;} 
			else if(updateType == `channel`) {streamerFollowers[i] = customValue;}
			else if(updateType == `image`) {customImages[i] = customValue;}
			
			let followersAsJSONString = JSON.stringify({ "followers" : streamerFollowers, "customMessages" : customMessages, "customImages" : customImages});
			result = await streamerAsJSON.update({ "followersInfo": followersAsJSONString });
			break;
		}
	}

	return result;
}

//Helper Functions

async function createTwitchStreamer(client, channelId, streamerId, streamerUsername, streamerDisplayName, streamerDescription, streamerIcon, customMessage, customImage) {
	try {
		let jsonFollowers = JSON.stringify({ "followers" : [channelId], "customMessages" : [customMessage], "customImages" : [customImage]});
		const curTime = Date.now();

		try{
			const dbEntryInserted = await client.dbs.twitchstreamers.create({
			streamerId: `${streamerId}`,
			streamerUsername: `${streamerUsername}`,
			streamerDisplayName: `${streamerDisplayName}`,
			streamerDescription: `${streamerDescription}`,
			streamerIcon: `${streamerIcon}`,
			streamerIconLastCheckedAt: `${curTime}`,
			lastOnline: `${curTime}`,
			followersInfo: `${jsonFollowers}`,
			});
			await twitchEventSubSubscribe(client, streamerId);
			return true;
		} catch(error) {
			console.log(`~createTwitchStreamer~/n${error}`);
			return false;
		}
		
	} catch(error) {
		console.log(`~~~~createTwitchStreamer~~~~\n${error}\n`);
	}
}

async function updateTwitchStreamer(client, streamerAsJSON, channelId, streamerId, customMessage, customImage, isDeletion) {
	let followersParsed = JSON.parse(streamerAsJSON.get(`followersInfo`));
	let streamerFollowers = followersParsed.followers;
	let customMessagesParsed = followersParsed.customMessages;
	let customImagesParsed = followersParsed.customImages;

	if(!isDeletion) {
		streamerFollowers.push(`${channelId}`);
		customMessagesParsed.push(customMessage);
		customImagesParsed.push(customImage);
	} else {   
		let index = streamerFollowers.indexOf(`${channelId}`);
		streamerFollowers.splice(index, 1);
		customMessagesParsed.splice(index, 1);
		customImagesParsed.splice(index, 1);
	}	
	
	let followersAsJSONString = JSON.stringify({"followers" : streamerFollowers, "customMessages" : customMessagesParsed, "customImages" : customImagesParsed});
	
	try {
		if(streamerFollowers.length > 0) {
			await streamerAsJSON.update({ "followersInfo": followersAsJSONString });
		} else {
			await streamerAsJSON.destroy();
			stopListeners(client, streamerId);
		}
		return true;	
	} catch (error) {
		let description = "Error in updateTwitchStreamer function."
		console.log(`~~~~updateTwitchStreamer~~~~\n${error}\n`);
		return false;
	}
}

function checkIfGuildIsAlreadySubscribedToStreamer(gs_tableEntry, streamerUsername, website) {
	let jsonParsed = JSON.parse(gs_tableEntry.get(`streamersInfo`));
	let jsonNames = jsonParsed.streamerUserNames;
	let jsonWebsites = jsonParsed.streamerWebsites;
	let jsonIds = jsonParsed.streamerIds;
	let wasFound = false;
	let streamerId = null;

	//If they are already subscribed to the user, do not continue. 
	for(i = 0; i < jsonNames.length; i++) {
		if (jsonNames[i] == streamerUsername && jsonWebsites[i] == website) {
			wasFound = true;
			streamerId = jsonIds[i];
			break;
		}
	}

	return {wasFound, streamerId};		
}

function checkIfGuildCanSubscribeToAnotherStreamer(gs_tableEntry) {
	let numSubbed = gs_tableEntry.get(`numStreamers`);
	return numSubbed < maxSubscribedTo ? true : false;
}

async function twitchEventSubSubscribe(client, streamerId) {
	try{
		const onlineSubscription = await client.twitchListener.onStreamOnline(streamerId, esStreamOnlineEvent => {
			streamerNotification(client, esStreamOnlineEvent, true);
		});

		const offlineSubscription = await client.twitchListener.onStreamOffline(streamerId, esStreamOfflineEvent => {
			streamerNotification(client, esStreamOfflineEvent, false);
		});

		client.hmap.set(streamerId, {onlineSubscription, offlineSubscription});
	} catch (error) {
		console.log(`~~~~twitchEventSubSubscribe~~~~\n${error}\n`);
	}
	
}

async function streamerNotification(client, streamEvent, isLiveNotification) {
	let dbEntry = await client.dbs.twitchstreamers.findOne({ where: { streamerId: `${streamEvent.broadcasterId}`}});
	if (dbEntry) {
		let curTime = `${Date.now()}`;
		const {streamerIcon, streamerIconLastCheckedAt} = await getStreamerIcon(client, dbEntry, streamEvent.broadcasterId, curTime);
		
		if(isLiveNotification) {
			//Get all of the guild channels that we need to notify, update last time online
			const followersInfoParsed = JSON.parse(dbEntry.get(`followersInfo`));
			let channelsToNotify = followersInfoParsed.followers;
			let customMessages = followersInfoParsed.customMessages;
			let customImages = followersInfoParsed.customImages;

			streamerWentLive(client, streamEvent, streamerIcon, channelsToNotify, customMessages, customImages);	
		} else {streamerWentOffline(client, streamEvent.broadcasterId);}
		
		dbEntry.update({lastOnline: `${curTime}`, streamerIcon: `${streamerIcon}`, streamerIconLastCheckedAt: `${streamerIconLastCheckedAt}`});
	} else {
		console.log("Streamer Notification triggered, but streamer was not found.");
	}
}

async function stopListeners(client, streamerId) {
	const {onlineSubscription, offlineSubscription} = client.hmap.get(streamerId);
	try{
		await onlineSubscription.stop();
		await offlineSubscription.stop();
		client.hmap.delete(streamerId);
	} catch (error) {
		console.log(`~~~~stopListeners~~~~\n${error}\n`)
	}
}

async function getStreamerIcon(client, streamerFromDB, streamerId, currentTime) {
	try{
		let streamerIcon, streamerIconLastCheckedAt;
		streamerIconLastCheckedAt = streamerFromDB.get(`streamerIconLastCheckedAt`);
		if((+currentTime) > (+streamerIconLastCheckedAt + 86400000)) {
			const streamerRefreshed = await client.twitchAPI.users.getUserById(streamerId);
			streamerIcon = streamerRefreshed.profilePictureUrl;
			streamerIconLastCheckedAt = currentTime;
		} else {
			streamerIcon = streamerFromDB.get(`streamerIcon`);
		}
		return {streamerIcon, streamerIconLastCheckedAt};
	} catch(error) {
		console.log(`getStreamerIcon error\n${error}`);
	}
	
}

async function createGuildSubs(client, guildId, channelId, streamerId, streamerUsername, streamerDisplayName, customMessage, customImage, website) {
	try {
		let jsonStreamers = JSON.stringify({ "channelIds" : [channelId], "streamerIds" : [streamerId], "streamerUserNames" : [streamerUsername], "streamerDisplayNames" :[streamerDisplayName], "customMessages" : [customMessage], "customImages" : [customImage], "streamerWebsites" : [website] });
		try {
			const dbEntryInserted = await client.dbs.guildsubs.create({
				guildId: `${guildId}`,
				streamersInfo: `${jsonStreamers}`,
				numStreamers: 1,
			}); 
			return true;
		} catch (error) {
			return false;
		}
		
	} catch(error) {
		console.log(`~~~~createGuildSubs~~~~\n${error}`);
		return null;
	}
			
}

async function updateGuildSubs(client, gs_tableEntry, guildId, channelId, streamerId, streamerUsername, streamerDisplayName, customMessage, customImage, website, isDeletion) {
	try {
		let jsonParsed = JSON.parse(gs_tableEntry.get(`streamersInfo`));
		
		let jsonChannels = jsonParsed.channelIds;
		let jsonIds = jsonParsed.streamerIds;
		let jsonNames = jsonParsed.streamerUserNames;
		let jsonDisplayNames = jsonParsed.streamerDisplayNames;
		let jsonCustomMessages = jsonParsed.customMessages;
		let jsonCustomImages = jsonParsed.customImages;
		let jsonWebsites = jsonParsed.streamerWebsites;

		let numSubbed = gs_tableEntry.get(`numStreamers`);
		let updatedRows = null;

		if(!isDeletion) {
			jsonChannels.push(channelId);
			jsonIds.push(streamerId);	
			jsonNames.push(streamerUsername);
			jsonDisplayNames.push(streamerDisplayName);
			jsonCustomMessages.push(customMessage);
			jsonCustomImages.push(customImage);
			jsonWebsites.push(website);
		} else {
			for(i = 0; i < jsonNames.length; i++) {
				if (jsonNames[i] == streamerUsername && jsonWebsites[i] == website) {
					if(numSubbed - 1 != 0 ) {
						jsonChannels.splice(i,1);
						jsonIds.splice(i,1);
						jsonNames.splice(i,1);
						jsonDisplayNames.splice(i,1);
						jsonCustomMessages.splice(i,1);
						jsonCustomImages.splice(i,1);
						jsonWebsites.splice(i,1);
						break;  
					} else {
						//Delete entry from table
						updatedRows = await gs_tableEntry.destroy();
					}
				}
			}
		}

		if(updatedRows == null) {
			numSubbed += (-1) ** isDeletion;
			jsonParsed  = JSON.stringify({"channelIds" : jsonChannels, "streamerIds" : jsonIds, "streamerUserNames" : jsonNames, "streamerDisplayNames" : jsonDisplayNames, "customMessages" : jsonCustomMessages, "customImages" : jsonCustomImages, "streamerWebsites" : jsonWebsites});
			updatedRows = await gs_tableEntry.update({streamersInfo: jsonParsed, numStreamers : numSubbed});
		}		
		
		if(updatedRows != null) {
			return true;
		} else {return false;}

	} catch (error) {
		console.log(`~~~~updateGuildSubs~~~~\n${error}`);
		return -1;
	}
}

async function streamerWentLive(client, streamEvent, streamerIcon, channelsToNotify, customMessages, customImages) {
	const vods = await getVODs(client, streamEvent.broadcasterId);
	const vod = getVOD(vods, streamEvent.id);
	let stream = await getStream(client, streamEvent.broadcasterId);;

	//Temp solution
	if(!stream && !vod) {return;}

	const streamURL = "https://twitch.tv/" + streamEvent.broadcasterName;
	//In the case of a streamer restarting the stream within a certain timeframe and number of restarts, just edit the previous message.
	let recentlyStreamed = await client.dbs.streamtemp.findOne({ where: { broadcasterId: streamEvent.broadcasterId }});
	if(recentlyStreamed && recentlyStreamed.streamIds.split(',').length < 10){
		const streamIds = recentlyStreamed.streamIds.split(',');
		const vodLinks = recentlyStreamed.vodLinks.split(',');

		streamIds.push(streamEvent.id);
		//TODO:Might have to add condition to make sure the vod isn't in vodLinks already
		if(vod){vodLinks.push(vod.url);}
		else {vodLinks.push("VNF");}
		
		recentlyStreamed.isLive = true;
		recentlyStreamed.streamIds = streamIds.join();
		recentlyStreamed.vodLinks = vodLinks.join();
		
		await recentlyStreamed.save();
		const channelSnowflakes = JSON.parse(recentlyStreamed.messagePairs);

		editMessages(client, channelSnowflakes, true, streamURL, vodLinks, recentlyStreamed.durations.split(','));
		return;
	} else if(recentlyStreamed){await recentlyStreamed.destroy();}

	//New stream entry.
	const customMessageEmbed = await embedHelper.createLiveStreamEmbed(streamEvent, streamerIcon, stream, vod);
	const customEmbed = embedHelper.copy(customMessageEmbed);
	customEmbed.setTitle(`${customMessageEmbed.data.author.name} | ${customMessageEmbed.data.title}`);
	
	let messagesSent = [];
	let messageSent, content, embed, channel;
	for(let i = 0; i < channelsToNotify.length; i++) {
		channel = await client.channels.fetch(channelsToNotify[i]);
		//If the channel exists, and the bot is in the channel and can send messages, then proceed.
		if(channel && channel.permissionsFor(client.user).has(["ViewChannel","SendMessages","EmbedLinks"])) {
			if(customMessages[i].length != 0) {
				content = customMessages[i];
				embed = customMessageEmbed;
			} else {
				content = ``;
				embed = customEmbed;
			}
			
			//Image is user defined. So if an error is thrown, the catch sends message + embed without the image.
			try{
				embed.setImage(customImages[i]);
				messageSent = await channel.send({content: content, embeds: [embed]});
				messagesSent.push({channelId: channelsToNotify[i], snowflake: messageSent.id});
			} catch {
				content = `***Image link for this user is broken. Change to a working link with /change_image***\n` + content;
				embed.setImage(null);
				messageSent = await channel.send({content: content, embeds: [embed]});
				messagesSent.push({channelId: channelsToNotify[i], snowflake: messageSent.id});
			}
		}
	}

	//Save stream info to the db
	let vodArr;
	if(vod){vodArr = vod.url;}
	else {vodArr = "VNF";}

	await client.dbs.streamtemp.create({
		broadcasterId: streamEvent.broadcasterId,
		streamURL: streamURL,
		messagePairs: JSON.stringify(messagesSent),
		isLive: true,
		streamIds: streamEvent.id,
		vodLinks: vodArr,
		durations: ""
	});
}

//The time in the video/duration(?), if vods[n] == "VNF"
async function streamerWentOffline(client, streamerId) {
	//Attempt to get info from database.
	let stream = await client.dbs.streamtemp.findOne({ where: { broadcasterId: streamerId }});
	if(stream) {
		let channelSnowflakes = JSON.parse(stream.messagePairs);
		stream.isLive = false;

		let {streamIds, vodLinks, durations} = await verifyAndUpdateVODsDuration(client, streamerId, stream.streamIds, stream.vodLinks, stream.durations);
		// streamIds[durations.length]

		stream.streamIds = streamIds;
		stream.vodLinks = vodLinks;
		stream.durations = durations;
		await stream.save();
		await editMessages(client, channelSnowflakes, false, stream.streamURL, vodLinks.split(','), durations.split(','));

		setTimeout(async () => {
			stream = await client.dbs.streamtemp.findOne({ where: { broadcasterId: streamerId }});
			//TODO: Add a counter/check a counter before destroying record.
			if(stream && stream.isLive == false){
				stream.destroy();
			}
		},240000);	
	}
}

async function getStream(client, streamerId) {
	const liveStream = await client.twitchAPI.streams.getStreamByUserId(streamerId);

	return liveStream;
}

async function getVODs(client, streamerId) {
	let vods = null;
	let vodFilter = {type: `archive`};
	({data: vods} = await client.twitchAPI.videos.getVideosByUser(streamerId, vodFilter));
	
	return vods;
}

function getVOD(vods, streamId) {
	if(!vods){return null;}
	for(let i = 0; i < vods.length; i++) {
		if(vods[i].streamId == streamId){
			return vods[i];
		}
	}
	return null;
}

//Handle editing embeds sent out, called when going offline, and when restarting the stream.
async function editMessages(client, channelSnowflakes, wentLive, streamURL, vodLinks, durations) {
	let channel, message, newEmbed, streamStatus, vodObj = null, liveValue, vodFieldName;
	
	if(vodLinks.length > 1){vodFieldName = `Link to VODs`;}
	else {vodFieldName = `Link to VOD`;}
	
	if(wentLive) {liveValue = `✅ Live ✅`}
	else {
		liveValue = `❌ Ended ❌`;
		streamURL += "/videos";
	}
	
	streamStatus = {name: `Stream Status` , value: liveValue, inline: false};
	let vodStr; 
	if(vodLinks && (vodLinks.length > 0)){vodStr = getVODString(vodLinks, durations);}
	if(vodStr){vodObj = [{name: vodFieldName, value: vodStr, inline: true}];}

	channelSnowflakes.forEach(async (obj) => {
		try{
			channel = await client.channels.fetch(obj.channelId);
			if(channel && channel.permissionsFor(client.user).has(["ViewChannel","SendMessages","EmbedLinks"])) {
				message = await channel.messages.fetch(obj.snowflake);
				if(message && message.editable) {
					newEmbed = embedHelper.copy(message.embeds[0]);
					newEmbed.setURL(streamURL);
					newEmbed.data.fields[0] = streamStatus;
					if(vodObj) {
						if(newEmbed.data.fields && (newEmbed.data.fields[newEmbed.data.fields.length - 1].name).match(/Link to VODs?/)){
							newEmbed.spliceFields(-1,1);
						}
						newEmbed.addFields(vodObj);
					}	
					await message.edit({embeds: [newEmbed]});
				}
			}
		} catch (error) {console.log(error);}
	});
}

//Used to wait for a specified amount of time, as twitch caches need time to update 
async function sleep(milliseconds) {
	let currentTime = Date.now();
	const stopTime = currentTime + milliseconds;
	
	while(currentTime < stopTime){
		currentTime = Date.now();
	}
}

function getVODString(vodLinks, vodDurations) {
	let str = "";
	for(let i = 0; i < vodLinks.length; i++){
		if(i < vodDurations.length) {
			if(vodLinks[i] == "VNF"){str += "VNF\n";}
			else{str += `[${vodDurations[i]}](${vodLinks[i]})\n`;}
		} else {
			if(i != vodDurations.length - 1){str += `NFY\n`;} 
			else if(vodLinks[i] == "VNF"){str +="VNF\n";}
			else {str +=`[Latest VOD](${vodLinks[vodLinks.length - 1]})`;}
		}
	}
	return str;
}

async function verifyAndUpdateVODsDuration(client, streamerId, streamIds, vodLinks, durations) {
	const vods = await getVODs(client, streamerId);

	if(!vods){return {streamIds, vodLinks, durations};}
	streamIds = streamIds.split(',');
	vodLinks = vodLinks.split(',');
	if(durations) {durations = durations.split(',');}
	else {durations = []}

	let curVOD;
	for(let i = 0; i < streamIds.length; i++) {
		curVOD = getVOD(vods, streamIds[i]);
		if(curVOD && durations.length == i){durations.push(curVOD.duration);}
		if(curVOD && vodLinks[i] == "VNF"){vodLinks[i] = curVOD.url;}
	}

	streamIds = streamIds.join();
	vodLinks = vodLinks.join();
	durations = durations.join();
	return {streamIds, vodLinks, durations};
}

//Manga tracking functions
async function loadPreviousManga(client) {
	//Load domains
	let rows = await client.dbs.mangadomains.findAll();
	let domain, obj;
	for(i = 0; i < rows.length; i++) {
		obj = rows.at(i);
		domain = obj.get("domain");

		client.domains.add(domain);
	}

	//Load Manga Series info

}

async function addMangaDomain(interaction, domain) {
	try {
		await interaction.client.dbs.mangadomains.create({
			domain: domain
		});
		interaction.client.domains.add(domain);
		interaction.reply(`Domain added: ${domain}`);
	} catch (err) {
		console.log(`Error adding the domain to the database`)
	}
}

async function deleteMangaDomain(interaction, domain) {
	try {
		const dbRow = await interaction.client.dbs.mangadomains.findOne({where: {domain: domain}});
		if(dbRow){await dbRow.destroy();}
		interaction.reply(`Domain deleted: ${domain}`);
	} catch (err) {
		console.log(`Error deleting the domain: ${domain}`);
	}
}

async function createMangaSeries(interaction, info) {
	try {
		const {domain, pathPrefix, identifier} = breakdownURL(info.url);
		const dbRow = await interaction.client.dbs.mangaseries.create({
			title: 			info.title,
			imageUrl: 		info.image,
			chapters: 		JSON.stringify(info.chapters),
			numChapters: 	info.chapters.length,
			domain: 		domain,
			pathPrefix: 	pathPrefix,
			identifier: 	identifier,
			guildsJSON: 	JSON.stringify([{guildId: interaction.guildId, channelId: info.channelId, channelMessage: info.channelMessage}])
		});
		
		return dbRow;
	} catch(error) {
		console.log(`Error adding series to database: ${error}`);
		return null;
	}
	
}

async function addUserToMangaSeries(interaction, dbRow, info){
	try{
		let success = false;
		const {domain, pathPrefix, identifier} = breakdownURL(info.url);
		if(dbRow) {
			const guilds = JSON.parse(dbRow.get(`guildsJSON`));
			guilds.push({guildId: info.guildId, channelId: info.channelId, channelMessage: info.channelMessage});
			return await dbRow.update({guildsJSON: JSON.stringify(guilds)});
		} 
		return dbRow;
	} catch(error) {
		console.log(`Error adding guild to the existing manga series: ${error}}`);
		return null;
	}
}

async function deleteMangaSeries(interaction, domain, identifier, guildId) {
	try {
		const dbRow = await interaction.client.dbs.mangaSeries.findOne({where: {domain: domain, identifier: identifier}});
		if(dbRow) {

		}
	} catch (error) {
		console.log(`Error deleting a manga series: ${error}`)
	}
}

async function checkLocalMangaSeries(interaction, [domain, identifier]) {
	try {
		const dbRow = await interaction.client.dbs.mangaseries.findOne({where: {domain: domain, identifier: identifier}});

		return dbRow;
	} catch(err) {
		console.log(`Error in checkLocalMangaSeries: ${err}`);
	}
}

function breakdownURL(url){
	let url_parts = url.split(/\/+/);
	//Identifier will be the last subdirectory
	const identifier = url_parts.pop();
	//Pop off https if it's there
	if(/https?:/.test(url_parts[0])){url_parts.shift();}

	const domain = url_parts.shift();
	const pathPrefix = url_parts.join('/');
	return {domain, pathPrefix, identifier};
}

async function getMangaGuildSubsTableEntry(interaction) {
	try {
		return await interaction.client.dbs.mangaguildsubs.findOne({where: {guildId: interaction.guildId}});
	} catch(error) {
		console.log(`Error getting Manga Guild Subs Entry : ${error}`);
	}
}

async function createMangaGuildSubsTableEntry(interaction, info) {
	try {
		const dbRow = await interaction.client.dbs.mangaguildsubs.create({
			guildId: interaction.guildId,
			mangaInfo: JSON.stringify([{channelId: info.channelId, channelMessage: info.channelMessage, domain: info.domain, title: info.title, identifier: info.identifier}]),
			numManga: 1
		});
		return dbRow;
	} catch (error) {
		console.log(`Error creating manga guild subs: ${error}`);
	}
}

async function addMangaToMGS(interaction, info, dbRow) {
	try {
		const manga = JSON.parse(dbRow.get(`mangaInfo`));
		const numManga = dbRow.get(`numManga`) + 1;
		manga.push({channelId: info.channelId, channelMessage: info.channelMessage, domain: info.domain, title: info.title, identifier: info.identifier});
		return await dbRow.update({mangaInfo: JSON.stringify(manga), numManga: numManga});
	} catch (error) {
		console.log(`Error adding manga to manga guild subs: ${error}`);
	}
}

async function mangaPreChecks(interaction, [domain, identifier], url) {
	const firstCheck = validateURL(interaction, url);
	if(firstCheck) {
		const dbRow = await interaction.client.dbs.mangaguildsubs.findOne({where: {guildId: interaction.guildId}});
		const secondCheck = !alreadyFollowingManga(interaction, dbRow, domain, identifier);
		if(secondCheck){
			const thirdCheck = canFollowMoreManga(interaction, dbRow);
			if(thirdCheck){return true;}
		}
	}
	interaction.client.guildSet.delete(interaction.guildId);
	return false;
}

function alreadyFollowingManga(interaction, dbRow, domain, identifier) {
	if(dbRow == null) {return false;}
	const mangaList = JSON.parse(dbRow.get(`mangaInfo`));
	for(const manga of mangaList) {
		if(manga.domain == domain && manga.identifier == identifier){
			interaction.reply(`Guild is already following that manga.`)
			return true;
		}
	}
	return false;
}

function canFollowMoreManga(interaction, dbRow) {
	if(dbRow == null) {return true;}
	const mangaList = JSON.parse(dbRow.get(`mangaInfo`));
	//TODO: allow certain guilds to ignore limit.
	if(mangaList.length >= maxSubscribedTo && !interaction.client.exemptGuilds.has(interaction.guildId)) {
		interaction.reply(`Guild cannot follow more manga.`)
		return false;
	}
	return true; 
}

function validateURL(interaction, url){
	let url_parts = url.split(/\/+/);
	if (url_parts.length < 2 || (url_parts.length == 2 && url_parts[0].match(/^https?:$/)) || (url_parts.length == 3 && url_parts[2] == '') ){
		interaction.reply("Error: Invalid url submitted.");
		return false;
	}
	let domain_index = 0;
	if(url_parts[domain_index].match(/^https?:$/)){domain_index = 1;}
	if(interaction.client.domains.has(url_parts[domain_index])){return true;}
	interaction.reply('Error: Invalid url or domain not supported. ');
	return false;
}

async function deleteFollowerFromMangaGuildSubs(mgs_te, position) {
	if(!mgs_te){return true;}
	const mangaList = JSON.parse(mgs_te.get(`mangaInfo`));
	mangaList.splice(position, 1);
	try {
		if(mangaList.length == 0) {
			await mgs_te.destroy();
			return true;
		} else {
			await mgs_te.update({mangaInfo: JSON.stringify(mangaList)});
			return true;
		}
	} catch(err) {
		return false;
	}
	
}

async function deleteFollowerFromMangaSeries(dbTable, guildId, domain, identifier) {
	const dbRow = await dbTable.findOne({where: {domain: domain, identifier: identifier}});
	if(dbRow) {
		const guilds = JSON.parse(dbRow.get(`guildsJSON`));
		for (let i = 0; i < guilds.length; i++) {
			if(guilds[i].guildId == guildId) {
				guilds.splice(i, 1);
				break;
			}
		}
		try {
			if(guilds.length == 0){
				await dbRow.destroy();
				return true;
			} else {
				await dbRow.update({guildsJSON: JSON.stringify(guilds)});
				return true;
			}
		} catch(err) {return false;}
	} else {
		return true;
	}
}

async function getFromMangaDbs(interaction, option){
	const mgs_te = await getMangaGuildSubsTableEntry(interaction);
	const mangaList = JSON.parse(mgs_te.get("mangaInfo"));
	const domain = mangaList[option].domain, identifier = mangaList[option].identifier, title = mangaList[option].title;
	return {mgs_te: mgs_te, title: title, domain: domain, identifier: identifier};
}

async function loadExemptGuilds(client){
	const exemptRows = await client.dbs.exemptguilds.findAll();
	for(const guildRow of exemptRows) {client.exemptGuilds.add(guildRow.guildId);}
}

async function addExemptGuild(client, guildId) {
	const numChanged = await client.dbs.exemptguilds.create({guildId: guildId});
	return numChanged ? true : false;
}