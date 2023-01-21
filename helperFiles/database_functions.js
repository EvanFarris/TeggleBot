const embedHelper = require(`./embed_functions.js`);

const maxSubscribedTo = 5;
module.exports = {
	addFollowerToTwitchStreamer,
	deleteFollowerFromTwitchStreamer,
	createGuildSubs,
	updateGuildSubs,
	checkIfGuildIsAlreadySubscribedToStreamer,
	checkIfGuildCanSubscribeToAnotherStreamer,
	getGuildSubsTableEntry,
	checkGuildSubs,
	twitchEventSubSubscribe,
	getTempInfo,
	storeTempInfo,
	deleteTempData,
	loadPreviousSubscriptions,
	updateCustomMessage
}

async function addFollowerToTwitchStreamer(interaction, streamerAsJSON, streamerId, streamerUsername, streamerDisplayName, channelId, streamerDescription, streamerIcon, customMessage) {
	if(streamerAsJSON != null) {
		return await updateTwitchStreamer(interaction.client, streamerAsJSON, channelId, streamerId, customMessage, false);
	} else {
		return await createTwitchStreamer(interaction, streamerUsername, streamerDisplayName, streamerId, channelId, streamerDescription, streamerIcon, customMessage);
	}
}

async function deleteFollowerFromTwitchStreamer(client, streamerAsJSON, streamerId, channelId) {
	return await updateTwitchStreamer(client, streamerAsJSON, channelId, streamerId, null, true);
}

async function createTwitchStreamer(interaction, streamerUsername, streamerDisplayName, streamerId, channelId, streamerDescription, streamerIcon, customMessage) {
	try {
		let jsonFollowers = JSON.stringify({ "followers" : [channelId], "customMessages" : [customMessage]});
		const time = new Date();
		const curTime = time.getTime();
		try{
			const dbEntryInserted = await interaction.client.dbs.twitchstreamers.create({
			streamerId: `${streamerId}`,
			streamerDisplayName: `${streamerDisplayName}`,
			streamerUsername: `${streamerUsername}`,
			streamerDescription: `${streamerDescription}`,
			streamerIcon: `${streamerIcon}`,
			streamerIconLastCheckedAt: `${curTime}`,
			lastOnline: `${curTime}`,
			followers: `${jsonFollowers}`,
			});
			await twitchEventSubSubscribe(interaction.client, streamerId);
			return true;
		} catch(error) {
			console.log(`~createTwitchStreamer~/n${error}`);
			return false;
		}
		
	} catch(error) {
		console.log(`~~~~createTwitchStreamer~~~~\n${error}\n`);
	}
}

async function updateTwitchStreamer(client, streamerAsJSON, channelId, streamerId, customMessage, isDeletion) {
	let followersParsed = JSON.parse(streamerAsJSON.get(`followers`));
	let streamerFollowers = followersParsed.followers;
	let customMessagesParsed = followersParsed.customMessages;

	if(!isDeletion) {
		streamerFollowers.push(`${channelId}`);
		customMessagesParsed.push(customMessage);
	} else {   
		let index = streamerFollowers.indexOf(`${channelId}`);
		streamerFollowers.splice(index, 1);
		customMessagesParsed.splice(index, 1);
	}	
	
	let followersAsJSONString = JSON.stringify({"followers" : streamerFollowers, "customMessages" : customMessagesParsed});
	
	try {
		if(streamerFollowers.length > 0) {
			await client.dbs.twitchstreamers.update({ "followers": followersAsJSONString }, {where: {streamerId: `${streamerId}`}});
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

async function createGuildSubs(interaction, streamerUsername, streamerDisplayName, streamerId, website, channelId, customMessage) {
	try {
		let jsonStreamers = JSON.stringify({ "names" : [streamerUsername], "streamerDisplayNames" :[streamerDisplayName], "websites" : [website], "channels" : [channelId], "streamerIds" : [streamerId], "customMessages" : [customMessage] });
		try {
			const dbEntryInserted = await interaction.client.dbs.guildsubs.create({
				guildId: `${interaction.guildId}`,
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

async function updateGuildSubs(interaction, gs_tableEntry, streamerUsername, streamerDisplayName, streamerId, website, channelId, customMessage, isDeletion) {
	try {
		let jsonParsed = JSON.parse(gs_tableEntry.get(`streamersInfo`));
		let jsonNames = jsonParsed.names;
		let jsonDisplayNames = jsonParsed.streamerDisplayNames;
		let jsonCustomMessages = jsonParsed.customMessages;
		let jsonWebsites = jsonParsed.websites;
		let jsonChannels = jsonParsed.channels;
		let jsonIds = jsonParsed.streamerIds;
		let numSubbed = gs_tableEntry.get(`numStreamers`);
		let updatedRows = null;

		if(!isDeletion) {
			jsonNames.push(streamerUsername);
			jsonDisplayNames.push(streamerDisplayName);
			jsonWebsites.push(website);
			jsonChannels.push(channelId);
			jsonCustomMessages.push(customMessage);
			jsonIds.push(streamerId);	
		} else {
			for(i = 0; i < jsonNames.length; i++) {
				if (jsonNames[i] == streamerUsername && jsonWebsites[i] == website) {
					if(numSubbed - 1 != 0 ) {
						jsonNames.splice(i,1);
						jsonDisplayNames.splice(i,1);
						jsonWebsites.splice(i,1);
						jsonChannels.splice(i,1);
						jsonCustomMessages.splice(i,1);
						jsonIds.splice(i,1);
						break;  
					} else {
						//Delete entry from table
						updatedRows = await interaction.client.dbs.guildsubs.destroy({where: { guildId: `${interaction.guildId}`}});
					}
				}
			}
		}

		if(updatedRows == null) {
			numSubbed += (-1) ** isDeletion;
			jsonParsed  = JSON.stringify({"names" : jsonNames, "websites" : jsonWebsites, "channels" : jsonChannels, "streamerIds" : jsonIds, "customMessages" : jsonCustomMessages, "streamerDisplayNames" : jsonDisplayNames});
			updatedRows = await interaction.client.dbs.guildsubs.update({streamersInfo: jsonParsed, numStreamers : numSubbed}, {where: {guildId: `${interaction.guildId}`}});
		}		
		
		if(updatedRows != null) {
			return true;
		} else {return false;}

	} catch (error) {
		console.log(`~~~~updateGuildSubs~~~~\n${error}`);
		return -1;
	}
}

function checkIfGuildIsAlreadySubscribedToStreamer(interaction, gs_tableEntry, streamerUsername, website) {
	let jsonParsed = JSON.parse(gs_tableEntry.get(`streamersInfo`));
	let jsonNames = jsonParsed.names;
	let jsonWebsites = jsonParsed.websites;
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

function checkIfGuildCanSubscribeToAnotherStreamer(interaction, gs_tableEntry) {
	let numSubbed = gs_tableEntry.get(`numStreamers`);
	return numSubbed >= maxSubscribedTo ? false : true;
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
		const time = new Date();
		let dbEntry = await client.dbs.twitchstreamers.findOne({ where: { streamerId: `${streamEvent.broadcasterId}`}});
		if (dbEntry) {
			//Get all of the guild channels that we need to notify, update last time online
			let channelsToNotify = JSON.parse(dbEntry.get('followers')).followers;
			let customMessages = JSON.parse(dbEntry.get(`followers`)).customMessages;
			let curTime = `${time.getTime()}`;
			let initialLength = channelsToNotify.length;
			const {streamerIcon, streamerIconLastCheckedAt} = await getStreamerIcon(client, dbEntry, streamEvent.broadcasterId, curTime);
			
			//Default message to send discord channel
			let channel;
			if(isLiveNotification) {
				const embed = await embedHelper.createLiveStreamEmbed(client, streamEvent, streamerIcon);
				for( i = 0; i < channelsToNotify.length; i++ ) {
					channel = await client.channels.cache.get(`${channelsToNotify[i]}`);

					if(channel) {
						try {
							if(customMessages[i].length != 0) {channel.send({content: customMessages[i], embeds: [embed]});}
							else {channel.send({embeds: [embed]});}
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
						if(channel) {channel.send(msg);}
					} catch (error) {
						console.log(`Error sending notification\n${error}`);
					}	
				}
			}
			
			if(channelsToNotify.length != initialLength) {
				let channelsUpdated = JSON.stringify({ "followers" : channelsToNotify, "customMessages" : customMessages});
				client.dbs.twitchstreamers.update({lastOnline: `${curTime}`, streamerIcon: `${streamerIcon}`, followers: `${channelsUpdated}`, streamerIconLastCheckedAt: `${streamerIconLastCheckedAt}`}, {where: {streamerId: `${streamEvent.broadcasterId}`}});
			} else {
				client.dbs.twitchstreamers.update({lastOnline: `${curTime}`, streamerIcon: `${streamerIcon}`, streamerIconLastCheckedAt: `${streamerIconLastCheckedAt}`}, {where: {streamerId: `${streamEvent.broadcasterId}`}});
			}
		} else {
			console.log("Streamer Notification triggered, but streamer was not found.");
		}
			
	} catch (error) {
		console.log(`~~~~streamerNotification~~~~\n${error}\n`);
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

async function checkGuildSubs(interaction, gs_tableEntry, streamerUsername, website, embeddedTitle) {
	if(gs_tableEntry) {
		let wasFound, streamerId, msg = "";
		({wasFound, streamerId} = checkIfGuildIsAlreadySubscribedToStreamer(interaction, gs_tableEntry, streamerUsername, website));

		if(wasFound) {
			msg = `You are already subscribed to this streamer.`;
		} else if (!(checkIfGuildCanSubscribeToAnotherStreamer(interaction, gs_tableEntry))) {
			msg = 'You can only have up to 5 streamers subscribed at a time.';
		}
				
		if(msg != "") {
			interaction.reply({ embeds : [embedHelper.createEmbed(embeddedTitle, msg)]});
			return false;
		}
	}
	return true;
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

async function getTempInfo(client, guildId, streamerUsername) {
	try {
		let streamerDisplayName = null, streamerId = null, channel = null, customMessage = null;
		let extraInfo = await client.dbs.temp.findOne({ where: { guildId: `${guildId}`, streamerUsername: `${streamerUsername}` }});
		if(extraInfo) {
			streamerDisplayName = extraInfo.get(`streamerDisplayName`);
			streamerId = extraInfo.get(`streamerId`);
			channelId = extraInfo.get(`channelId`);
			customMessage = extraInfo.get(`customMessage`);
			await extraInfo.destroy();
		}

		return { streamerDisplayName, streamerId, channelId, customMessage };
	} catch (error) {
		console.log(`getExtraSubInfo\n${error}`);
	}
}

async function storeTempInfo(client, guildId, streamerUsername, channelId, streamerId, streamerDisplayName, customMessage) {
	try {
		const dbEntryInserted = await client.dbs.temp.create({
			guildId: guildId,
			streamerUsername: streamerUsername,
			channelId: channelId,
			streamerId: streamerId,
			streamerDisplayName: streamerDisplayName,
			customMessage: customMessage
		});
	} catch(error) {
		console.log(`storeTempInfo\n${error}`);
	}
}

async function deleteTempData(client, guildId, streamerUsername) {
	try {
		let tempDB = await client.dbs.temp.findOne({ where: { guildId: `${guildId}`, streamerUsername: `${streamerUsername}` }});
		if(tempDB) {tempDB.destroy();}
	} catch(error) {
		console.log(`deleteTempData\n${error}`);
	}
	
}

async function loadPreviousSubscriptions(client) {
	let rows = await client.dbs.twitchstreamers.findAll();
	let sName, sId, obj;
	let curDate = new Date();
	let curTime = curDate.getTime();
	
	const cutoffTime = curTime - (1000 * 60 * 60 * 24 * 30);
	
	for(i = 0; i < rows.length; i++) {
		obj = rows.at(i);
		sName = obj.get("streamerUsername");
		sId = obj.get("streamerId");
		if(obj.get("lastOnline") > cutoffTime) {
			await twitchEventSubSubscribe(client, sId);
		} else { 
		}

		
	}
}

async function updateCustomMessage(client, gs_tableEntry, streamerAsJSON, streamerId, channelId, customMessage) {
	let followersParsed = JSON.parse(streamerAsJSON.get(`followers`));
	let streamerFollowers = followersParsed.followers;
	let customMessages = followersParsed.customMessages;

	const streamerName = streamerAsJSON.streamerUsername;
	
	const streamersInfo = JSON.parse(gs_tableEntry.streamersInfo);
	const streamerNames = streamersInfo.names;
	const streamerMessages = streamersInfo.customMessages;
	const streamerDisplayNames = streamersInfo.streamerDisplayNames;
	const streamerWebsites = streamersInfo.websites;
	const streamerChannels = streamersInfo.channels;
	const streamerIds = streamersInfo.streamerIds;

	for(i = 0; i < streamerNames.length; i++) {
		if(streamerNames[i] == streamerName) {
			let stringifiedInfo = JSON.stringify({"names": streamerNames, "customMessages": streamerMessages, "streamerDisplayNames" : streamerDisplayNames, "websites": streamerWebsites, "channels": streamerChannels, "streamerIds": streamerIds});
			await client.dbs.guildsubs.update({"streamersInfo" : stringifiedInfo}, {where: {guildId: client.guildId}});
			break;
		}
	}

	for(i = 0; i < streamerFollowers.length; i++) {
		if(streamerFollowers[i] == channelId) {
			customMessages[i] = customMessage;
			break;
		}
	}
	let followersAsJSONString = JSON.stringify({ "followers" : streamerFollowers, "customMessages" : customMessages});
	const result = await client.dbs.twitchstreamers.update({ "followers": followersAsJSONString }, {where: {streamerId: `${streamerId}`}});

	return result;
}