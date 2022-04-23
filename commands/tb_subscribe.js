const { SlashCommandBuilder } = require('@discordjs/builders');

function isValidTwitchUsername(username) {
	let regex = /[^\w]+/;
	if(!regex.test(username) && username.length >= 4 && username.length <= 25) {return true;}
	else {return false;}
}

function checkUrl(msg) {
	let twitchRegex = /.*twitch.tv\//;
	let youtubeRegex = /.*youtube.com\/[user\/]*/;
	let website = "";
	let username = "";
	if(twitchRegex.test(msg)) {
		website = "twitch";
		username = msg.replace(twitchRegex,"").toLowerCase();
	} else if (youtubeRegex.test(msg)) {
		website = "youtube";
		username = msg.replace(youtubeRegex,"").toLowerCase();
	}

	return { website, username };
}

async function checkTwitchStreamerExistsLocal(interaction, username) {
	try {
		let ts_streamer = await interaction.client.dbs.twitchstreamers.findOne({ where: { username: `${username}` }});
		if(ts_streamer) {return ts_streamer;} 
		else {return null;}
	} catch (error) {
		console.log(`checkTwitchStreamerExistsLocal error:\n${error}`)
		interaction.reply(`Error occured while trying to see if a streamer exists locally.`);
		return null;
	}
}

async function checkTwitchStreamerExistsAPI(client, username) {
	try {
		const user = await client.twitchAPI.helix.users.getUserByName(`${username}`);
		if(user) {
			return user.id;
		} else {
			return "";
		}
	} catch (error) {
		console.log(`Error in response from the twitch API: ${error}`);
		return "!error!";
	}
	
}

async function createTwitchStreamer(interaction, username, streamerId) {
	try {
			let jsonfollowers = JSON.stringify({ "followers" : [interaction.channelId] });
			const time = new Date();
			const dbEntryInserted = await interaction.client.dbs.twitchstreamers.create({
				username: `${username}`,
				streamerId: `${streamerId}`,
				lastOnline: `${time.getTime()}`,
				followers: `${jsonfollowers}`
				});
			await twitchEventSubSubscribe(interaction, streamerId);

		} catch(error) {
			console.log(`Error in createTwitchStreamer\n${error}`);
		}
}

async function updateTwitchStreamer(interaction, streamer) {
	let streamerParsed = JSON.parse(streamer.get('followers')).followers;
	streamerParsed.push(`${interaction.channelId}`);
	let streamerFollowers = JSON.stringify({"followers" : streamerParsed});
	
	try {
		await interaction.client.dbs.twitchstreamers.update({ "followers": streamerFollowers }, {where: {username: `${streamer.get('username')}`}});
	} catch (error) {
		await interaction.reply("Error in \"updateTwitchStreamer function.");
	}
}

async function twitchEventSubSubscribe(interaction, streamerId) {
	try{
		console.log(`twitchEventSubSubscribe called. Streamerid: ${streamerId}`);
		const onlineSubscription = await interaction.client.twitchlistener.subscribeToStreamOnlineEvents(streamerId, streamer => {
			try {
				console.log("OnlineSubscription called.");
				let dbEntry = interaction.client.dbs.twitchstreamers.findOne({ where: { username: `${streamer.broadcasterDisplayName.toLowerCase()}`}});
				let jsonParsed = JSON.parse(dbEntry.get('followers')).followers;
				let newDate = `${streamer.startDate}`;
				const updatedRows = interaction.client.dbs.twitchstreamers.update({lastOnline: `${newDate}`}, {where: {username: `${streamer.broadcasterDisplayName.toLowerCase()}`}});
				for( follower in jsonParsed ) {
					interaction.client.channels.cache.get(`${follower}`).send(`${streamer.broadcasterDisplayName} is now live!`);
				}
			} catch (error2) {
				console.log(`Error when notifying servers that a streamer went live.\n${error2}`);
			}
		});

		const offlineSubscription = await interaction.client.twitchlistener.subscribeToStreamOfflineEvents(streamerId, streamer => {
			try {
				console.log("OfflineSubscription called.");
				let dbEntry = interaction.client.dbs.twitchstreamers.findOne({ where: { username: `${streamer.broadcasterDisplayName.toLowerCase()}`}});
				let jsonParsed = JSON.parse(dbEntry.get('followers')).followers;
				let newDate = `${streamer.startDate}`;
				const updatedRows = interaction.client.dbs.twitchstreamers.update({lastOnline: `${newDate.getTime()}`}, {where: {username: `${streamer.broadcasterDisplayName.toLowerCase()}`}});
			} catch (error2) {
				console.log(`Error when notifying servers that a streamer went offline.\n${error2}`);
			}
		});
		console.log(`${typeof(onlineSubscription)} ${typeof(offlineSubscripition)}`);
	} catch (error1) {
		console.log(`Error setting up a subscription.\n${error1}`);
	}
	
}

function twitchEventSubUnsubscribe(interaction, streamerId) {

}



module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_subscribe')
		.setDescription('Subscribe to a streamer.')
		.addStringOption(option =>
			option.setName('url')
			.setDescription('The url to the streamer you want to subscribe to.')
			.setRequired(true)),
	async execute(interaction) {
		if(interaction.memberPermissions.has(`ADMINISTRATOR`) || interaction.memberPermissions.has('MANAGE_WEBHOOKS')) { 
			
			let msg = interaction.options.getString('url');
			let { website, username } = checkUrl(msg);

			//Check if we have a valid website/username combo.
			if(website === "") {
				return interaction.reply('Invalid url entered.');;
			} else if(username == "") {
				return interaction.reply("Username must not be empty.");
			} else if(website == "twitch" && !isValidTwitchUsername(username)){
				return interaction.reply("Invalid username entered.");
			}

			let gs_tableEntry = null;
			try {
				gs_tableEntry = await interaction.client.dbs.guildsubs.findOne({ where: { guildID: `${interaction.guildId}` }});
			} catch (error) {
				return interaction.reply(`Error occured while trying to subscribe.\n${error}`);
			}

			let jsonParsed = null;
			let jsonNames = null;
			let jsonWebsites = null;
			let numSubbed = null;
			if(gs_tableEntry) { //If there is an entry in GUILD_SUBS, retrieve it, check if they have < 5 subscribed users, 
				numSubbed = gs_tableEntry.get(`numStreamers`);
				if(numSubbed < 5) {
					jsonParsed = JSON.parse(gs_tableEntry.get(`streamers`));
					jsonNames = jsonParsed.names;
					jsonWebsites = jsonParsed.websites;
					
					//If they are already subscribed to the user, do not continue. 
					for(i = 0; i < jsonNames.length; i++) {
						if (jsonNames[i] == username && jsonWebsites[i] == website) {
							return interaction.reply(`${username} has already been subscribed to.`);
						}
					}

				} else {
					return interaction.reply('You can only have up to 5 streamers subscribed at a time.');
				}
				
			} 

			//Call the correct api to see if the user is real, update/create streamer if they exist.
			let response;
			let streamerID;
			let streamer;
			if(website == "twitch") {
				//check local database
				streamer = await checkTwitchStreamerExistsLocal(interaction, username);
				if(streamer == null){ //We don't have the streamer in TWITCH_STREAMERS
					streamerID = await checkTwitchStreamerExistsAPI(interaction.client, username);
					if(streamerID != "" && streamerID != "!error!") {
						createTwitchStreamer(interaction, username, streamerID);
					} else {
						return interaction.reply('User does not exist.');
					}
							
				} else { //We do have the streamer in TWITCH_STREAMERS
						updateTwitchStreamer(interaction, streamer);
					}

			} else if(website == "youtube") {
						//TODO: Youtube implementation
				}
			//Update GUILD_SUBS
			if(gs_tableEntry) {
				try {
					jsonNames.push(username);
					jsonWebsites.push(website);
					numSubbed++;
					jsonParsed  = JSON.stringify({"names" : jsonNames, "websites" : jsonWebsites });
						
					const updatedRows = await interaction.client.dbs.guildsubs.update({streamers: jsonParsed, numStreamers : numSubbed}, {where: {guildID: `${interaction.guildId}`}});
					if(updatedRows > 0) {
						return interaction.reply(`You have successfully subscribed to: ${username} on ${website}`);
					} else {
						return interaction.reply('Something went wrong inserting an entry into an existing subscription list.');
					}

				} catch (error) {
					await interaction.reply(`Something went wrong updating the database entry.`);
				}
			} else {
				//Create new entry in GUILD_SUBS
				try {
					let jsonTEST = JSON.stringify({ "names" : [username], "websites" : [website] });
					const dbEntryInserted = await interaction.client.dbs.guildsubs.create({
						guildID: `${interaction.guildId}`,
						streamers: `${jsonTEST}`,
						numStreamers: 1,
					});
					await interaction.reply(`You have successfully subscribed to: ${username} on ${website}`);
				} catch(error) {
					await interaction.reply('Something went wrong while creating the entry for the first subscription in the database.');
				}
			}

		} else {
			await interation.reply('You must have either the Administrator permission or the Manage Webhooks permission to use this command.');
		}
		
	},
	
};