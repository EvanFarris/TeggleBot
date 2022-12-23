const subHelper = require(`./subscribe_helper.js`);
const embeddedTitle = `TeggleBot Subscribe Results`;
module.exports = {
	isValidTwitchUsername,
	splitURLToComponents,
	checkTwitchStreamerExistsLocal,
	validateStreamerExists,
	checkTwitchStreamerExistsAPI,
	isWebsiteSupported
}

function isValidTwitchUsername(streamerUsername) {
	let regex = /[^\w]+/;
	if(!regex.test(streamerUsername) && streamerUsername.length >= 4 && streamerUsername.length <= 25) {return true;}
	else {return false;}
}


function splitURLToComponents(msg) {
	let twitchRegex = /.*twitch.tv\//;
	let youtubeRegex = /.*youtube.com\/[user\/]*/;
	let website = "";
	let streamerUsername = "";
	
	if(twitchRegex.test(msg)) {
		website = "twitch";
		streamerUsername = msg.replace(twitchRegex,"").toLowerCase();
	} else if (youtubeRegex.test(msg)) {
		website = "youtube";
		streamerUsername = msg.replace(youtubeRegex,"").toLowerCase();
	}

	return { website, streamerUsername };
}

function isWebsiteSupported(interaction, streamerUsername, website) {
	let valid = true;
	let description;
	
	if(website === "") {
		description = 'Invalid url entered.';
		valid = false;
	} else if(streamerUsername == "") {
		description = "Username must not be empty.";
		valid = false;
	} else if(website == "twitch" && !isValidTwitchUsername(streamerUsername)){
		description = "Invalid username entered.";
		valid = false;
	}

	if(!valid) {
		interaction.reply({ embeds : [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
	}

	return valid;
}

async function validateStreamerExists(interaction, streamerUsername, website) {
	//Call the correct api to see if the user is real.
	let streamerId = null;
	let streamerAsJSON = null;
	let streamerDisplayName = null;

	if(website == "twitch") {
		//check local database
		streamerAsJSON = await checkTwitchStreamerExistsLocal(interaction, streamerUsername);
		if(streamerAsJSON == null){ //We don't have the streamer in TWITCH_STREAMERS
			({streamerId, streamerDisplayName}  = await checkTwitchStreamerExistsAPI(interaction.client, streamerUsername));
			if(streamerId == null || streamerId == "!error!") {
				let description = 'User does not exist.';
				interaction.reply({ embeds : [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
			}				
		} else {
			streamerDisplayName = streamerAsJSON.get(`streamerDisplayName`);
		}

		return { streamerAsJSON, streamerId, streamerDisplayName };
	} else if(website == "youtube") {
		//TODO: Youtube implementation
		return { streamerAsJSON, streamerId };
	}
}

async function checkTwitchStreamerExistsLocal(interaction, streamerUsername) {
	try {
		let ts_streamer = await interaction.client.dbs.twitchstreamers.findOne({ where: { streamerUsername: `${streamerUsername}` }});
		if(ts_streamer) {return ts_streamer;} 
		else {return null;}
	} catch (error) {
		console.log(`~~~~checkTwitchStreamerExistsLocal~~~~\n${error}\n`)
		let description = `Error occured while trying to see if a streamer exists locally.`;
		interaction.reply({ embeds : [createEmbeddedMessage(embeddedTitle, description)]});
		return null;
	}
}

async function checkTwitchStreamerExistsAPI(client, streamerUsername) {
	try {
		const user = await client.twitchAPI.users.getUserByName(`${streamerUsername}`);
		if(user) {
			let streamerId = `${user.id}`;
			let streamerDisplayName = user.displayName;
			return { streamerId, streamerDisplayName };
		} else {
			let streamerId = null, streamerDisplayName = null;
			return { streamerId, streamerDisplayName };
		}
	} catch (error) {
		console.log(`~~~~checkTwitchStreamerExistsAPI~~~~\n${error}\n`);
		return "!error!";
	}
	
}

