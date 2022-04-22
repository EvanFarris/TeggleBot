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
		const user = await client.twitchAPI.helix.users.getUserByName(username);
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

function createTwitchStreamer(interaction, username, streamerId) {
	try {
			let jsonfollowers = JSON.stringify({ "followers" : [interaction.channelid] });
			const time = new Date();
			const dbEntryInserted = interaction.client.dbs.twitchstreamers.create({
				username: `${username}`,
				streamerId: `${streamerId}`,
				lastOnline: `${time.getTime()}`,
				followers: `${jsonfollowers}`
				});
			//twitchEventSubSubscribe(interaction, streamerId);

		} catch(error) {
			console.log(`Error in createTwitchStreamer\n${error}`);
		}
}

function twitchEventSubSubscribe(interaction, streamerId) {
	const onlineSubscription = interaction.client.twitchlistener.subscribeToStreamOnlineEvents(streamerId, streamer => {
		try {
			let dbEntry = interaction.client.dbs.twitchstreamers.findOne({ where: { username: `${streamer.broadcasterDisplayName}`}});
			let jsonParsed = JSON.parse(dbEntry.get('followers'));
			let newDate = new Date();
			const updatedRows = interaction.client.dbs.twitchstreamers.update({lastOnline: `${newDate.getTime()}`}, {where: {username: `${streamer.broadcasterDisplayName}`}});
			for( follower in jsonParsed.followers ) {
				interaction.client.channels.cache.get(`${follower}`).send(`${streamer.broadcasterDisplayName} is now live!`);
			}
		} catch (error) {
			console.log("Error when notifying servers that a streamer went live.");
		}
	});

	const offlineSubscription = interaction.client.twitchlistener.subscribeToStreamOnlineEvents(streamerId, streamer => {
		try {
			let dbEntry = interaction.client.dbs.twitchstreamers.findOne({ where: { username: `${streamer.broadcasterDisplayName}`}});
			let jsonParsed = JSON.parse(dbEntry.get('followers'));
			let newDate = new Date();
			const updatedRows = interaction.client.dbs.twitchstreamers.update({lastOnline: `${newDate.getTime()}`}, {where: {username: `${streamer.broadcasterDisplayName}`}});
		} catch (error) {
			console.log("Error when notifying servers that a streamer went offline.");
		}
	});
}

function twitchEventSubUnsubscribe(interaction, streamerId) {

}

function updateTwitchStreamer(interaction, streamer) {
	let streamerParsed = JSON.parse(streamer.get('followers'));
	let streamerFollowers = streamerParsed.followers;
	streamFollowers.push(`${interaction.channelid}`);
	try {
		interaction.client.dbs.twitchstreamers.update({ "followers": JSON.stringify(streamFollowers)}, {where: {username: `${streamer.get('username')}`}});
	} catch (error) {
		interaction.reply("Error in \"updateTwitchStreamer function.");
	}
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
				return interaction.reply("Invalid username.");
			}

			let gs_tableEntry = null;
			try {
				gs_tableEntry = await interaction.client.dbs.guildsubs.findOne({ where: { guildID: `${interaction.guildid}` }});
			} catch (error) {
				return interaction.reply(`Error occured while trying to subscribe.\n${error}`);
			}

			if(gs_tableEntry) { //If there is an entry in GUILD_SUBS, retrieve it, check if they have < 5 subscribed users, 
				let numSubbed = gs_tableEntry.get(`numStreamers`);
				if(numSubbed < 5) {
					let jsonParsed = JSON.parse(gs_tableEntry.get(`streamers`));
					let jsonNames = jsonParsed.names;
					let jsonWebsites = jsonParsed.websites;
					
					//If they are already subscribed to the user, do not continue. 
					for(i = 0; i < jsonNames.length; i++) {
						if (jsonNames[i] == username && jsonWebsites[i] == website) {
							return interaction.reply(`${username} has already been subscribed to.`);
						}
					}

					//Call the correct api to see if the user is real, update/create streamer if they exist.
					let response;
					let streamerID;
					let streamer;
					if(website == "twitch") {
						//check local database
						streamer = await checkTwitchStreamerExistsLocal(interaction, username);
						console.log(`streamer: ${streamer}`);
						if(streamer == null){ //We don't have the streamer in TWITCH_STREAMERS
							streamerID = await checkTwitchStreamerExistsAPI(interaction.client, username);
							console.log(`streamerID: ${streamerID}`);
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

					//update GUILD_SUBS
					try {
						jsonNames.push(username);
						jsonWebsites.push(website);
						numSubbed++;
						jsonParsed  = JSON.stringify({"names" : jsonNames, "websites" : jsonWebsites });

						const updatedRows = await interaction.client.dbs.guildsubs.update({streamers: jsonParsed, numStreamers : numSubbed}, {where: {guildID: `${interaction.guildid}`}});
						if(updatedRows > 0) {
							return interaction.reply(`You have successfully subscribed to: ${username} on ${website}`);
						} else {
							return interaction.reply('Something went wrong inserting an entry into an existing subscription list.');
						}

					} catch (error) {
						await interaction.reply(`Something went wrong updating the database entry.`);
					}

				} else {
					await interaction.reply('You can only have up to 5 streamers subscribed at a time.');
				}
				
			} else { // New entry into gs_table
				//check to see if streamer is 
				let response;
				let streamerID;
				let streamer;
				if(website == "twitch") {
					//check local database
					streamer = await checkTwitchStreamerExistsLocal(interaction, username);
					if(streamer == null){ //We don't have the streamer in TWITCH_STREAMERS
						streamerID = checkTwitchStreamerExistsAPI(interaction.client, username);
						if(streamerID != "") {
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

				try {
					let jsonTEST = JSON.stringify({ "names" : [username], "websites" : [website] });
					const dbEntryInserted = await interaction.client.dbs.guildsubs.create({
						guildID: `${interaction.guildid}`,
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