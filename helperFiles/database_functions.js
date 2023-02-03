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
	checkGuildSubs,
	getTempInfo,
	loadPreviousSubscriptions,
	updateProperty
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

async function getGuildSubsTableEntry(client, guildId) {
	try {
		gs_tableEntry = await client.dbs.guildsubs.findOne({ where: { guildId: `${guildId}` }});
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
	
	const cutoffTime = curTime - (1000 * 60 * 60 * 24 * 30);
	
	for(i = 0; i < rows.length; i++) {
		obj = rows.at(i);
		sName = obj.get("streamerUsername");
		sId = obj.get("streamerId");
		if(obj.get("lastOnline") > cutoffTime) {
			await twitchEventSubSubscribe(client, sId);
		} else { 
			//TODO: Remove all followers from guild_subs, then remove the streamer from twitch_subs
		}
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
		const onlineSubscription = await client.twitchListener.subscribeToStreamOnlineEvents(streamerId, esStreamOnlineEvent => {
			streamerNotification(client, esStreamOnlineEvent, true);
		});

		const offlineSubscription = await client.twitchListener.subscribeToStreamOfflineEvents(streamerId, esStreamOfflineEvent => {
			streamerNotification(client, esStreamOfflineEvent, false);
		});

		client.hmap.set(streamerId, {onlineSubscription, offlineSubscription});
	} catch (error) {
		console.log(`~~~~twitchEventSubSubscribe~~~~\n${error}\n`);
	}
	
}

async function streamerNotification(client, streamEvent, isLiveNotification) {
	try {
		let dbEntry = await client.dbs.twitchstreamers.findOne({ where: { streamerId: `${streamEvent.broadcasterId}`}});
		if (dbEntry) {
			//Get all of the guild channels that we need to notify, update last time online
			const followersInfoParsed = JSON.parse(dbEntry.get(`followersInfo`));
			let channelsToNotify = followersInfoParsed.followers;
			let customMessages = followersInfoParsed.customMessages;
			let customImages = followersInfoParsed.customImages;
			let curTime = `${Date.now()}`;
			let initialLength = channelsToNotify.length;
			const {streamerIcon, streamerIconLastCheckedAt} = await getStreamerIcon(client, dbEntry, streamEvent.broadcasterId, curTime);
			
			//Default message to send discord channel
			let channel;
			if(isLiveNotification) {
				const customMessageEmbed = await embedHelper.createLiveStreamEmbed(client, streamEvent, streamerIcon);
				const customEmbed = embedHelper.copy(customMessageEmbed);
				customEmbed.setTitle(`${customMessageEmbed.data.author.name} | ${customMessageEmbed.data.title}`);
				
				for( i = 0; i < channelsToNotify.length; i++ ) {
					channel = await client.channels.cache.get(`${channelsToNotify[i]}`);
					if(channel && channel.permissionsFor(client.user).has(["ViewChannel","SendMessages","EmbedLinks"])) {
						try {
							if(customMessages[i].length != 0) {
								try{
									customMessageEmbed.setImage(customImages[i]);
									channel.send({content: customMessages[i], embeds: [customMessageEmbed]});
								} catch {
									customMessageEmbed.setImage(null);
									const errorMsg = `***Image link for this user is broken. Change to a working link with /change_image***\n${customMessages[i]}`
									channel.send({content: errorMsg, embeds: [customMessageEmbed]});
								}
								
							}
							else {	
								try{
									customEmbed.setImage(customImages[i]);
									channel.send({embeds: [customEmbed]});
								} catch {
									customEmbed.setImage(null);
									channel.send({content: `***Image link for this user is broken. Change to a working link with /change_image***`, embeds: [customEmbed]});
								}
							}
						} catch (error) {
							console.log(`Error sending notification\n${error}`);
						}
					}
				}
			} else {
				msg = `${streamEvent.broadcasterDisplayName} went offline!`;
				for( i = 0; i < channelsToNotify.length; i++ ) {
					channel = await client.channels.cache.get(`${channelsToNotify[i]}`);
					try{
						if(channel && channel.permissionsFor(client.user).has(["ViewChannel","SendMessages","EmbedLinks"])) {channel.send(msg);}
					} catch (error) {
						console.log(`Error sending notification\n${error}`);
					}	
				}
			}
			
			if(channelsToNotify.length != initialLength) {
				let channelsUpdated = JSON.stringify({ "followers" : channelsToNotify, "customMessages" : customMessages, "customImages": customImages});
				dbEntry.update({lastOnline: `${curTime}`, streamerIcon: `${streamerIcon}`, followersInfo: `${channelsUpdated}`, streamerIconLastCheckedAt: `${streamerIconLastCheckedAt}`});
			} else {
				dbEntry.update({lastOnline: `${curTime}`, streamerIcon: `${streamerIcon}`, streamerIconLastCheckedAt: `${streamerIconLastCheckedAt}`});
			}
		} else {
			console.log("Streamer Notification triggered, but streamer was not found.");
		}
			
	} catch (error) {
		console.log(`~~~~streamerNotification~~~~\n${error}\n`);
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