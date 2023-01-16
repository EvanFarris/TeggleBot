const subHelper = require(`./subscribe_helper.js`);
const embeddedTitle = `TeggleBot Subscribe Results`;
const maxSubscribedTo = 5;
module.exports = {
	addFollowerToTwitchStreamer,
	deleteFollowerFromTwitchStreamer,
	createGuildSubs,
	updateGuildSubs,
	checkIfGuildIsAlreadySubscribedToStreamer,
	checkIfGuildCanSubscribeToAnotherStreamer,
	getGuildSubsTableEntry,
	checkGuildSubs
}

async function addFollowerToTwitchStreamer(interaction, streamerAsJSON, streamerId, streamerUsername, streamerDisplayName, channelId) {
	if(streamerAsJSON != null) {
		await updateTwitchStreamer(interaction, streamerAsJSON, channelId, null, false);
	} else {
		await createTwitchStreamer(interaction, streamerUsername, streamerDisplayName, streamerId, channelId);
	}
}

async function deleteFollowerFromTwitchStreamer(interaction, streamerAsJSON, streamerId, channelId) {
	return await updateTwitchStreamer(interaction, streamerAsJSON, channelId, streamerId, true);
}

async function createTwitchStreamer(interaction, streamerUsername, streamerDisplayName, streamerId, channelId) {
	try {
		let jsonFollowers = JSON.stringify({ "followers" : [channelId], "customMessages" : [""]});
		const time = new Date();
		const dbEntryInserted = await interaction.client.dbs.twitchstreamers.create({
			streamerId: `${streamerId}`,
			streamerDisplayName: `${streamerDisplayName}`,
			streamerUsername: `${streamerUsername}`,
			lastOnline: `${time.getTime()}`,
			followers: `${jsonFollowers}`,
			});
		await twitchEventSubSubscribe(interaction, streamerId);

	} catch(error) {
		console.log(`~~~~createTwitchStreamer~~~~\n${error}\n`);
	}
}

async function updateTwitchStreamer(interaction, streamerAsJSON, channelId, streamerId, isDeletion) {
	let followersParsed = JSON.parse(streamerAsJSON.get('followers')).followers;
	let customMessagesParsed = JSON.parse(streamerAsJSON.get('followers')).customMessages;
	if(!isDeletion) {
		followersParsed.push(`${channelId}`);
		customMessagesParsed.push(``);
	} else {
		let index = followersParsed.indexOf(`${channelId}`);
		followersParsed.splice(index, 1);
		customMessagesParsed.splice(index, 1);
	}	
	
	let followersAsJSONString = JSON.stringify({"followers" : followersParsed, "customMessages" : customMessagesParsed});
	
	try {
		if(followersParsed.length > 0) {
			await interaction.client.dbs.twitchstreamers.update({ "followers": followersAsJSONString }, {where: {streamerId: `${streamerId}`}});
		} else {
			await streamerAsJSON.destroy();
			stopListeners(interaction, streamerId);
		}
		return true;	
	} catch (error) {
		let description = "Error in updateTwitchStreamer function."
		console.log(`~~~~updateTwitchStreamer~~~~\n${error}\n`);
		await interaction.reply({ embeds : [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
		return false;
	}
}

async function createGuildSubs(interaction, streamerUsername, streamerId, website) {
	try {
		let jsonStreamers = JSON.stringify({ "names" : [streamerUsername], "websites" : [website], "channels" : [interaction.channelId], "streamerIds" : [streamerId] });
		const dbEntryInserted = await interaction.client.dbs.guildsubs.create({
			guildId: `${interaction.guildId}`,
			streamersInfo: `${jsonStreamers}`,
			numStreamers: 1,
		});
		return interaction.channelId;
	} catch(error) {
		console.log(`~~~~createGuildSubs~~~~\n${error}`);
		return null;
	}
			
}

async function updateGuildSubs(interaction, gs_tableEntry, streamerUsername, streamerId, website, isDeletion) {
	try {
		let jsonParsed = JSON.parse(gs_tableEntry.get(`streamersInfo`));
		let jsonNames = jsonParsed.names;
		let jsonWebsites = jsonParsed.websites;
		let jsonChannels = jsonParsed.channels;
		let jsonIds = jsonParsed.streamerIds;
		let channelId = null;

		let numSubbed = gs_tableEntry.get(`numStreamers`);
		let updatedRows = null;

		if(!isDeletion) {
			jsonNames.push(streamerUsername);
			jsonWebsites.push(website);
			jsonChannels.push(interaction.channelId);
			jsonIds.push(streamerId);	
			channelId = interaction.channelId;
		} else {
			for(i = 0; i < jsonNames.length; i++) {
				if (jsonNames[i] == streamerUsername && jsonWebsites[i] == website) {
					if(numSubbed - 1 != 0 ) {
						channelId = jsonChannels[i];
						jsonNames = jsonNames.splice(i,1);
						jsonWebsites = jsonWebsites.splice(i,1);
						jsonChannels = jsonChannels.splice(i,1);
						jsonIds = jsonIds.splice(i,1);
						jsonParsed  = JSON.stringify({"names" : jsonNames, "websites" : jsonWebsites, "channels" : jsonChannels });
						break;
					} else {
						//Delete entry from table
						channelId = jsonChannels[0];
						updatedRows = await interaction.client.dbs.guildsubs.destroy({where: { guildId: `${interaction.guildId}`}});
					}
				}
			}
		}
			
		if(updatedRows == null) {
			numSubbed += (-1) ** isDeletion;
			jsonParsed  = JSON.stringify({"names" : jsonNames, "websites" : jsonWebsites, "channels" : jsonChannels, "streamerIds" : jsonIds });
			updatedRows = await interaction.client.dbs.guildsubs.update({streamersInfo: jsonParsed, numStreamers : numSubbed}, {where: {guildId: `${interaction.guildId}`}});
		}		
			
		return {updatedRows, channelId};

	} catch (error) {
		console.log(`~~~~updateGuildSubs~~~~\n${error}`);
		return -1;
	}
}

async function checkIfGuildIsAlreadySubscribedToStreamer(interaction, gs_tableEntry, streamerUsername, website) {
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

async function checkIfGuildCanSubscribeToAnotherStreamer(interaction, gs_tableEntry) {
	let numSubbed = gs_tableEntry.get(`numStreamers`);
	return numSubbed >= maxSubscribedTo ? false : true;
	if(numSubbed >= maxSubscribedTo) {
		let description = 'You can only have up to 5 streamers subscribed at a time.'
		await interaction.reply({ embeds : [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
		return false;
	}

	return true;
}

async function twitchEventSubSubscribe(interaction, streamerId) {
	try{
		const onlineSubscription = await interaction.client.twitchlistener.subscribeToStreamOnlineEvents(streamerId, esStreamOnlineEvent => {
			streamerNotification(interaction, esStreamOnlineEvent, true);
		});

		const offlineSubscription = await interaction.client.twitchlistener.subscribeToStreamOfflineEvents(streamerId, esStreamOfflineEvent => {
			streamerNotification(interaction, esStreamOfflineEvent, false);
		});

		interaction.client.hmap.set(streamerId, {onlineSubscription, offlineSubscription});
	} catch (error) {
		console.log(`~~~~twitchEventSubSubscribe~~~~\n${error}\n`);
	}
	
}

//TODO: create embed with stream info, set it in 198
async function streamerNotification(interaction, streamEvent, isLiveNotification) {
	try {
		const time = new Date();
		let dbEntry = await interaction.client.dbs.twitchstreamers.findOne({ where: { streamerId: `${streamEvent.broadcasterId}`}});
		if (dbEntry) {
			//Get all of the guild channels that we need to notify, update last time online
			let channelsToNotify = JSON.parse(dbEntry.get('followers')).followers;
			let customMessages = JSON.parse(dbEntry.get(`followers`)).customMessages;
			let newDate = `${time.getTime()}`;
			
			interaction.client.dbs.twitchstreamers.update({lastOnline: `${newDate}`}, {where: {streamerId: `${streamEvent.broadcasterId}`}});
			
			//Default message to send discord channel
			let msg, channel;
			if(isLiveNotification) {
				const embed = await subHelper.createLiveStreamEmbed(interaction, streamEvent);
				msg = `${streamEvent.broadcasterDisplayName} is now live!`;
				for( i = 0; i < channelsToNotify.length; i++ ) {
					channel = await interaction.client.channels.cache.get(`${channelsToNotify[i]}`);
					if(customMessages[i].length != 0) {channel.send({content: customMessages[i], embeds: [embed]});}
					else {channel.send({content: msg, embeds: [embed]});}
				}
			} else {
				msg = `${streamEvent.broadcasterDisplayName} went offline!`;
				for( i = 0; i < channelsToNotify.length; i++ ) {
					channel = await interaction.client.channels.cache.get(`${channelsToNotify[i]}`);
					channel.send(msg);
				}
			}
			
		} else {
			console.log("Streamer Notification triggered, but streamer was not found.");
		}
			
	} catch (error) {
		console.log(`~~~~streamerNotification~~~~\n${error}\n`);
	}
}

async function getGuildSubsTableEntry(interaction) {
	try {
		gs_tableEntry = await interaction.client.dbs.guildsubs.findOne({ where: { guildId: `${interaction.guildId}` }});
		return gs_tableEntry;
	} catch (error) {
		console.log(`~~~~getGuildSubsTableEntry~~~~\n${error}\n`);
		let description = `Error occured while trying to subscribe.\n`;
		interaction.reply({ embeds : [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
		return null;
	}
}

async function stopListeners(interaction, streamerId) {
	const {onlineSubscription, offlineSubscription} = interaction.client.hmap.get(streamerId);
	try{
		await onlineSubscription.stop();
		await offlineSubscription.stop();
		interaction.client.hmap.delete(streamerId);
	} catch (error) {
		console.log(`~~~~stopListeners~~~~\n${error}\n`)
	}
}

async function checkGuildSubs(interaction, gs_tableEntry, streamerUsername, website, embeddedTitle) {
	if(gs_tableEntry) {
		let wasFound, streamerId, msg = "";
		({wasFound, streamerId} = await checkIfGuildIsAlreadySubscribedToStreamer(interaction, gs_tableEntry, streamerUsername, website));
		
		if(wasFound) {
			msg = `You are already subscribed to this streamer.`;
		} else if (!(await checkIfGuildCanSubscribeToAnotherStreamer(interaction, gs_tableEntry))) {
			msg = 'You can only have up to 5 streamers subscribed at a time.';
		}
				
		if(msg != "") {
			interaction.reply({ embeds : [subHelper.createEmbeddedMessage(embeddedTitle, msg)]});
			return false;
		}
	}
	return true;
}