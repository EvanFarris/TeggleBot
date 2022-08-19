const subHelper = require(`./subscribe_helper.js`);
const embeddedTitle = `TeggleBot Subscribe Results`;
const maxSubscribedTo = 5;
module.exports = {
	createTwitchStreamer,
	updateTwitchStreamer,
	createGuildSubs,
	updateGuildSubs,
	checkIfStreamerIsInGuildSubsAlready,
	checkIfGuildCanSubscribeToAnotherStreamer,
}

async function createTwitchStreamer(interaction, username, streamerId) {
	try {
			let jsonFollowers = JSON.stringify({ "followers" : [interaction.channelId] });
			const time = new Date();
			const dbEntryInserted = await interaction.client.dbs.twitchstreamers.create({
				username: `${username}`,
				streamerId: `${streamerId}`,
				lastOnline: `${time.getTime()}`,
				followers: `${jsonFollowers}`
				});
			await twitchEventSubSubscribe(interaction, streamerId);

		} catch(error) {
			console.log(`~~~~createTwitchStreamer~~~~\n${error}\n`);
		}
}

async function updateTwitchStreamer(interaction, streamer) {
	let streamerParsed = JSON.parse(streamer.get('followers')).followers;
	streamerParsed.push(`${interaction.channelId}`);
	let streamerStringified = JSON.stringify({"followers" : streamerParsed});
	
	try {
		await interaction.client.dbs.twitchstreamers.update({ "followers": streamerStringified }, {where: {username: `${streamer.get('username')}`}});
	} catch (error) {
		let description = "Error in updateTwitchStreamer function."
		console.log(`~~~~updateTwitchStreamer~~~~\n${error}\n`);
		await interaction.reply({ embeds : [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
	}
}

async function createGuildSubs(interaction, username, website) {
	try {
		let jsonStreamers = JSON.stringify({ "names" : [username], "websites" : [website], "channels" : [interaction.channelId] });
		const dbEntryInserted = await interaction.client.dbs.guildsubs.create({
			guildID: `${interaction.guildId}`,
			streamers: `${jsonStreamers}`,
			numStreamers: 1,
		});
		return 1;
	} catch(error) {
		console.log(`~~~~createGuildSubs~~~~\n${error}`);
		return -1;
	}
			
}

async function updateGuildSubs(interaction, gs_tableEntry, username, website) {
	try {
			let jsonParsed = JSON.parse(gs_tableEntry.get(`streamers`));
			let jsonNames = jsonParsed.names;
			let jsonWebsites = jsonParsed.websites;
			let jsonChannels = jsonParsed.channels;

			let numSubbed = gs_tableEntry.get(`numStreamers`);

			jsonNames.push(username);
			jsonWebsites.push(website);
			jsonChannels.push(interaction.guildId);
			numSubbed++;
			jsonParsed  = JSON.stringify({"names" : jsonNames, "websites" : jsonWebsites });
						
			const updatedRows = await interaction.client.dbs.guildsubs.update({streamers: jsonParsed, numStreamers : numSubbed}, {where: {guildID: `${interaction.guildId}`}});
			return updatedRows;

		} catch (error) {
			console.log(`~~~~updateGuildSubs~~~~\n${error}`);
			return -1;
		}
}

async function checkIfStreamerIsInGuildSubsAlready(interaction, gs_tableEntry, username, website) {
	let jsonParsed = JSON.parse(gs_tableEntry.get(`streamers`));
	let jsonNames = jsonParsed.names;
	let jsonWebsites = jsonParsed.websites;
				
	//If they are already subscribed to the user, do not continue. 
	for(i = 0; i < jsonNames.length; i++) {
		if (jsonNames[i] == username && jsonWebsites[i] == website) {
			let description = `${username} has already been subscribed to.`;
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
			let dbEntry = await interaction.client.dbs.twitchstreamers.findOne({ where: { username: `${streamer.broadcasterDisplayName.toLowerCase()}`}});
			if(dbEntry) {
				let jsonParsed = JSON.parse(dbEntry.get('followers')).followers;
				let newDate = `${time.getTime()}`;
				const updatedRows = await interaction.client.dbs.twitchstreamers.update({lastOnline: `${newDate}`}, {where: {username: `${streamer.broadcasterDisplayName.toLowerCase()}`}});
				let msg;
				//console.log(`${interaction} ${streamerId} ${streamer} ${isLiveNotification}`);
				if(isLiveNotification) {msg = `${streamer.broadcasterDisplayName} is now live!`;}
				else {msg = `${streamer.broadcasterDisplayName} went offline!`;}

				let channel;
				for( i = 0; i < jsonParsed.length; i++ ) {
					channel = await interaction.client.channels.cache.get(`${jsonParsed[i]}`);
					channel.send(msg);
				}
			} else {
				console.log("Streamer not found");
			}
			
	} catch (error) {
			console.log(`~~~~streamerNotification~~~~\n${error}\n`);
	}
}