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
	getGuildSubsTableEntry
}

async function addFollowerToTwitchStreamer(interaction, streamerAsJSON, streamerId, streamerUsername, channelId) {
	if(streamerAsJSON != null) {
		await updateTwitchStreamer(interaction, streamerAsJSON, channelId, null, false);
	} else {
		await createTwitchStreamer(interaction, streamerUsername, streamerId, channelId);
	}
}
async function deleteFollowerFromTwitchStreamer(interaction, streamerAsJSON, streamerId, streamerUsername, channelId) {
	await updateTwitchStreamer(interaction, streamerAsJSON, channelId, streamerId, true);
}

async function createTwitchStreamer(interaction, streamerUsername, streamerId, channelId) {
	try {
		let jsonFollowers = JSON.stringify({ "followers" : [channelId] });
		const time = new Date();
		const dbEntryInserted = await interaction.client.dbs.twitchstreamers.create({
			streamerUsername: `${streamerUsername}`,
			streamerId: `${streamerId}`,
			lastOnline: `${time.getTime()}`,
			followers: `${jsonFollowers}`
			});
		await twitchEventSubSubscribe(interaction, streamerId);

	} catch(error) {
		console.log(`~~~~createTwitchStreamer~~~~\n${error}\n`);
	}
}

async function updateTwitchStreamer(interaction, streamerAsJSON, channelId, streamerId, isDeletion) {
	let followersParsed = JSON.parse(streamerAsJSON.get('followers')).followers;
	if(!isDeletion) {
		followersParsed.push(`${channelId}`);
	} else {
		followersParsed.splice(followersParsed.indexOf(`${channelId}`), 1);
	}	
	
	let followersAsJSONString = JSON.stringify({"followers" : followersParsed});
	
	try {
		if(followersParsed.length > 0) {
			await interaction.client.dbs.twitchstreamers.update({ "followers": followersAsJSONString }, {where: {streamerUsername: `${streamerAsJSON.get('streamerUsername')}`}});
		} else {
			await streamerAsJSON.destroy();
			stopListeners(interaction, streamerId);
		}	
	} catch (error) {
		let description = "Error in updateTwitchStreamer function."
		console.log(`~~~~updateTwitchStreamer~~~~\n${error}\n`);
		await interaction.reply({ embeds : [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
	}
}

async function createGuildSubs(interaction, streamerUsername, website) {
	try {
		let jsonStreamers = JSON.stringify({ "names" : [streamerUsername], "websites" : [website], "channels" : [interaction.channelId] });
		const dbEntryInserted = await interaction.client.dbs.guildsubs.create({
			guildID: `${interaction.guildId}`,
			streamers: `${jsonStreamers}`,
			numStreamers: 1,
		});
		return interaction.channelId;
	} catch(error) {
		console.log(`~~~~createGuildSubs~~~~\n${error}`);
		return null;
	}
			
}

async function updateGuildSubs(interaction, gs_tableEntry, streamerUsername, website, isDeletion) {
	try {
		let jsonParsed = JSON.parse(gs_tableEntry.get(`streamers`));
		let jsonNames = jsonParsed.names;
		let jsonWebsites = jsonParsed.websites;
		let jsonChannels = jsonParsed.channels;
		let channelId = null;

		let numSubbed = gs_tableEntry.get(`numStreamers`);
		let updatedRows = null;

		if(!isDeletion) {
			jsonNames.push(streamerUsername);
			jsonWebsites.push(website);
			jsonChannels.push(interaction.channelId);	
			channelId = interaction.channelId;
		} else {
			for(i = 0; i < jsonNames.length; i++) {
				if (jsonNames[i] == streamerUsername && jsonWebsites[i] == website) {
					if(numSubbed - 1 != 0 ) {
						channelId = jsonChannels[i];
						jsonNames = jsonNames.slice(0,i).concat(jsonNames.splice(i + 1,jsonNames.length));
						jsonWebsites = jsonWebsites.slice(0,i).concat(jsonWebsites.slice(i + 1,jsonWebsites.length));
						jsonChannels = jsonChannels.slice(0,i).concat(jsonChannels.slice(i + 1,jsonChannels.length));
						jsonParsed  = JSON.stringify({"names" : jsonNames, "websites" : jsonWebsites, "channels" : jsonChannels });
						break;
					} else {
						//Delete entry from table
						channelId = jsonChannels[0];
						updatedRows = await interaction.client.dbs.guildsubs.destroy({where: { guildID: `${interaction.guildId}`}});
					}
				}
			}
		}
			
		if(updatedRows == null) {
			numSubbed += (-1) ** isDeletion;
			jsonParsed  = JSON.stringify({"names" : jsonNames, "websites" : jsonWebsites, "channels" : jsonChannels });
			updatedRows = await interaction.client.dbs.guildsubs.update({streamers: jsonParsed, numStreamers : numSubbed}, {where: {guildID: `${interaction.guildId}`}});
		}		
			
		return {updatedRows, channelId};

	} catch (error) {
		console.log(`~~~~updateGuildSubs~~~~\n${error}`);
		return -1;
	}
}

async function checkIfGuildIsAlreadySubscribedToStreamer(interaction, gs_tableEntry, streamerUsername, website) {
	let jsonParsed = JSON.parse(gs_tableEntry.get(`streamers`));
	let jsonNames = jsonParsed.names;
	let jsonWebsites = jsonParsed.websites;
				
	//If they are already subscribed to the user, do not continue. 
	for(i = 0; i < jsonNames.length; i++) {
		if (jsonNames[i] == streamerUsername && jsonWebsites[i] == website) {
			let description = `${streamerUsername} has already been subscribed to.`;
			await interaction.reply({ embeds : [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
			return true;
		}
	}

	return false;		
}

async function checkIfGuildCanSubscribeToAnotherStreamer(interaction, gs_tableEntry) {
	let numSubbed = gs_tableEntry.get(`numStreamers`);
	
	if(numSubbed >= maxSubscribedTo) {
		let description = 'You can only have up to 5 streamers subscribed at a time.'
		await interaction.reply({ embeds : [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
		return false;
	}

	return true;
}

async function twitchEventSubSubscribe(interaction, streamerId) {
	try{
		const onlineSubscription = await interaction.client.twitchlistener.subscribeToStreamOnlineEvents(streamerId, streamer => {
			streamerNotification(interaction, streamerId, streamer, true);
		});

		const offlineSubscription = await interaction.client.twitchlistener.subscribeToStreamOfflineEvents(streamerId, streamer => {
			streamerNotification(interaction, streamerId, streamer, false);
		});

		interaction.client.hmap.set(streamerId, {onlineSubscription, offlineSubscription});
	} catch (error) {
		console.log(`~~~~twitchEventSubSubscribe~~~~\n${error}\n`);
	}
	
}

async function streamerNotification(interaction, streamerId, streamer, isLiveNotification) {
	try {
			const time = new Date();
			let dbEntry = await interaction.client.dbs.twitchstreamers.findOne({ where: { streamerUsername: `${streamer.broadcasterDisplayName.toLowerCase()}`}});
			if(dbEntry) {
				let jsonParsed = JSON.parse(dbEntry.get('followers')).followers;
				let newDate = `${time.getTime()}`;
				const updatedRows = await interaction.client.dbs.twitchstreamers.update({lastOnline: `${newDate}`}, {where: {streamerUsername: `${streamer.broadcasterDisplayName.toLowerCase()}`}});
				let msg;
				if(isLiveNotification) {msg = `${streamer.broadcasterDisplayName} is now live!`;}
				else {msg = `${streamer.broadcasterDisplayName} went offline!`;}

				let channel;
				for( i = 0; i < jsonParsed.length; i++ ) {
					channel = await interaction.client.channels.cache.get(`${jsonParsed[i]}`);
					let { messageDescription, wantCHannel, channelDescription} = subHelper.getGuildPreferences(`${jsonParsed[i]}`, streamerId);
					channel.send(msg);
				}
			} else {
				console.log("Streamer not found");
			}
			
	} catch (error) {
			console.log(`~~~~streamerNotification~~~~\n${error}\n`);
	}
}

async function getGuildSubsTableEntry(interaction) {
	try {
		gs_tableEntry = await interaction.client.dbs.guildsubs.findOne({ where: { guildID: `${interaction.guildId}` }});
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