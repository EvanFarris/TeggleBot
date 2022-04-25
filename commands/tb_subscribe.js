const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const wait = require(`node:timers/promises`).setTimeout;
const maxSubscribedTo = 5;
const embeddedTitle = `TeggleBot Subscribe Results`;

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
			if(interaction.isCommand()) {
				let msg = interaction.options.getString('url');
				let { website, username } = checkUrl(msg);

				//Check if we have a valid website/username combo.

				if(website === "") {
					let description = 'Invalid url entered.';
					return interaction.reply({ embeds : [createEmbeddedMessage(embeddedTitle, description)]});;
				} else if(username == "") {
					let description = "Username must not be empty.";
					return interaction.reply({ embeds : [createEmbeddedMessage(embeddedTitle, description)]});
				} else if(website == "twitch" && !isValidTwitchUsername(username)){
					let description = "Invalid username entered.";
					return interaction.reply({ embeds : [createEmbeddedMessage(embeddedTitle, description)]});
				}
			
				const gs_tableEntry = await getGuildSubsTableEntry(interaction);
				//Check to see if the guild is subscribed to anyone. 
				//If they are, make sure the streamer to be added isn't already subscribed to in the local database already.
				//Also, the guild must have room to subscribe to continue.
				if(gs_tableEntry && ((await checkIfStreamerIsInGuildSubsAlready(interaction, gs_tableEntry, username, website)) || !(await checkIfGuildCanSubscribeToAnotherStreamer(interaction, gs_tableEntry)))) { return; }
				const { streamer, streamerId } = await validateUserExists(interaction, username, website);

				const actionRow = new MessageActionRow()
					.addComponents(
							new MessageButton()
								.setCustomId('tb_subscribe_yes')
								.setLabel(`Yes (Subscribe)`)
								.setStyle(`PRIMARY`),
							new MessageButton()
								.setCustomId(`tb_subscribe_no`)
								.setLabel(`No`)
								.setStyle(`SECONDARY`),
						);
				let replyEmbedded = await createEmbeddedMessageComplicated(username, website, interaction.client.twitchAPI);
				await interaction.reply({ ephemeral: true, embeds: [replyEmbedded], components: [actionRow] })
					.then(() => {
						setTimeout(function() {
						actionRow.components[0].setDisabled(true);
						actionRow.components[1].setDisabled(true);
						interaction.editReply({ephemeral: true, embeds: [replyEmbedded], components: [actionRow]});
						},8000)
					});

				const filter = i => i.customId == "tb_subscribe_yes" || i.customId == "tb_subscribe_no";
				const collector = interaction.channel.createMessageComponentCollector({ filter, time: 8000 });
				collector.on(`collect`, async i => {
					actionRow.components[0].setDisabled(true);
					actionRow.components[1].setDisabled(true);
					interaction.editReply({ephemeral: true, embeds: [replyEmbedded], components: [actionRow]});
				});


			} else if (interaction.isButton() && interaction.customId == "tb_subscribe_yes") {
				//Update TWITCH_STREAMERS table
				let { username, website, streamerId, streamer, gs_tableEntry } = await getFromEmbedded(interaction);
				if(website == "twitch" && streamer != null) {
						await updateTwitchStreamer(interaction, streamer);
				} else if(website == "twitch" && streamerId != "" && streamerId != "!error") {
						await createTwitchStreamer(interaction, username, streamerId);
				} else if(website == "youtube") {

				} else { //Something went wrong, end the function.
					return;
				}

				//Update GUILD_SUBS table
				let succeeded;
				if(gs_tableEntry != null) {
					succeeded = await updateGuildSubs(interaction, gs_tableEntry, username, website);					
				} else {
					succeeded = await createGuildSubs(interaction, username, website);
				} 

				if(succeeded == 1) {
					const usernameFixed = username.charAt(0).toUpperCase() + username.slice(1);
					const description = `You have successfully subscribed to ${usernameFixed}`; 
					
					await interaction.reply({ embeds: [createEmbeddedMessage(embeddedTitle, description)]});
				}
			}

		} else {
			await interation.reply('You must have either the Administrator permission or the Manage Webhooks permission to use this command.');
		}
		
	},
	
};

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
		console.log(`~~~~checkTwitchStreamerExistsLocal~~~~\n${error}\n`)
		let description = `Error occured while trying to see if a streamer exists locally.`;
		interaction.reply({ embeds : [createEmbeddedMessage(embeddedTitle, description)]});
		return null;
	}
}

async function checkTwitchStreamerExistsAPI(client, username) {
	try {
		const user = await client.twitchAPI.users.getUserByName(`${username}`);
		if(user) {
			return user.id;
		} else {
			return "";
		}
	} catch (error) {
		console.log(`~~~~checkTwitchStreamerExistsAPI~~~~\n${error}\n`);
		return "!error!";
	}
	
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
		let description = "Error in \"updateTwitchStreamer function."
		console.log(`~~~~updateTwitchStreamer~~~~\n${error}\n`);
		await interaction.reply({ embeds : [createEmbeddedMessage(embeddedTitle, description)]});
	}
}

async function updateGuildSubs(interaction, gs_tableEntry, username, website) {
	try {
			let jsonParsed = JSON.parse(gs_tableEntry.get(`streamers`));
			let jsonNames = jsonParsed.names;
			let jsonWebsites = jsonParsed.websites;
			let numSubbed = gs_tableEntry.get(`numStreamers`);

			jsonNames.push(username);
			jsonWebsites.push(website);
			numSubbed++;
			jsonParsed  = JSON.stringify({"names" : jsonNames, "websites" : jsonWebsites });
						
			const updatedRows = await interaction.client.dbs.guildsubs.update({streamers: jsonParsed, numStreamers : numSubbed}, {where: {guildID: `${interaction.guildId}`}});
			return updatedRows;

		} catch (error) {
			console.log(`~~~~updateGuildSubs~~~~\n${error}`);
			return -1;
		}
}

async function createGuildSubs(interaction, username, website) {
	try {
		let jsonStreamers = JSON.stringify({ "names" : [username], "websites" : [website] });
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

async function twitchEventSubSubscribe(interaction, streamerId) {
	try{
		const onlineSubscription = await interaction.client.twitchlistener.subscribeToStreamOnlineEvents(streamerId, streamer => {
			streamerNotification(interaction, streamerId, streamer, true);
		});

		const offlineSubscription = await interaction.client.twitchlistener.subscribeToStreamOfflineEvents(streamerId, streamer => {
			streamerNotification(interaction, streamerId, streamer, false);
		});

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

async function getGuildSubsTableEntry(interaction) {
	try {
		gs_tableEntry = await interaction.client.dbs.guildsubs.findOne({ where: { guildID: `${interaction.guildId}` }});
		return gs_tableEntry;
	} catch (error) {
		console.log(`~~~~getGuildSubsTableEntry~~~~\n${error}\n`);
		let description = `Error occured while trying to subscribe.\n`;
		interaction.reply({ embeds : [createEmbeddedMessage(embeddedTitle, description)]});
		return null;
	}
}

async function checkIfGuildCanSubscribeToAnotherStreamer(interaction, gs_tableEntry) {
	let numSubbed = gs_tableEntry.get(`numStreamers`);
	
	if(numSubbed >= maxSubscribedTo) {
		let description = 'You can only have up to 5 streamers subscribed at a time.'
		await interaction.reply({ embeds : [createEmbeddedMessage(embeddedTitle, description)]});
		return false;
	}

	return true;
}

async function checkIfStreamerIsInGuildSubsAlready(interaction, gs_tableEntry, username, website) {
	let jsonParsed = JSON.parse(gs_tableEntry.get(`streamers`));
	let jsonNames = jsonParsed.names;
	let jsonWebsites = jsonParsed.websites;
				
	//If they are already subscribed to the user, do not continue. 
	for(i = 0; i < jsonNames.length; i++) {
		if (jsonNames[i] == username && jsonWebsites[i] == website) {
			let description = `${username} has already been subscribed to.`;
			await interaction.reply({ embeds : [createEmbeddedMessage(embeddedTitle, description)]});
			return true;
		}
	}

	return false;		
}

async function validateUserExists(interaction, username, website) {
	//Call the correct api to see if the user is real.
	let streamerId = null;
	let streamer = null;
	if(website == "twitch") {
		//check local database
		streamer = await checkTwitchStreamerExistsLocal(interaction, username);
		if(streamer == null){ //We don't have the streamer in TWITCH_STREAMERS
			streamerId = await checkTwitchStreamerExistsAPI(interaction.client, username);
			if(streamerId == "" || streamerId == "!error!") {
				let description = 'User does not exist.';
				interaction.reply({ embeds : [createEmbeddedMessage(embeddedTitle, description)]});
			}				
		}

		return { streamer, streamerId };
	} else if(website == "youtube") {
		//TODO: Youtube implementation
		return { streamer, streamerId };
	}
}

function createEmbeddedMessage(title, description) {
	const embeddedMessage = new MessageEmbed()
		.setColor(`#09f`)
		.setTitle(title)
		.setDescription(description);
	return embeddedMessage;
}

async function createEmbeddedMessageComplicated(username, website, twitchAPI) {
	const embeddedMessage = new MessageEmbed()
		.setColor(`#0099ff`)
		.setTitle(`Retrieved ${username} from the ${website} API`)
		.setDescription(`Is this the correct streamer?`);

	if(website == "twitch") {
		let streamerObject = await twitchAPI.users.getUserByName(username);
		embeddedMessage.setTitle(`Is this the correct streamer?`)
			.setImage(streamerObject.profilePictureUrl)
			.setURL(`https://twitch.tv/${username}`)
			.setDescription(streamerObject.description);
	} else if (website == "youtube") {

	}

	return embeddedMessage;
}

async function getFromEmbedded(interaction) {
	let { website, username } = checkUrl(interaction.message.embeds[0].url);
	let gs_tableEntry = await getGuildSubsTableEntry(interaction);
	const { streamer, streamerId } = await validateUserExists(interaction, username, website);

	return { username, website, streamerId, streamer, gs_tableEntry };
}