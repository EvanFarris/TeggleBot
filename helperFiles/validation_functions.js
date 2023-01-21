const embedHelper = require(`./embed_functions.js`);
const embeddedTitle = `TeggleBot Subscribe Results`;
module.exports = {
	isValidTwitchUsername,
	splitURLToComponents,
	checkTwitchStreamerExistsLocal,
	validateStreamerExists,
	checkTwitchStreamerExistsAPI,
	isWebsiteSupported
}

//Makes sure the username passed in has only valid characters, and has the correct length
function isValidTwitchUsername(streamerUsername) {
	let regex = /[^\w]+/;
	if(!regex.test(streamerUsername) && streamerUsername.length >= 3 && streamerUsername.length <= 25) {return true;}
	else {return false;}
}

function splitURLToComponents(msg) {
	let twitchRegex = /.*twitch.tv\//;
	let website = "";
	let streamerUsername = "";
	
	if(twitchRegex.test(msg)) {
		website = "twitch";
		streamerUsername = msg.replace(twitchRegex,"").toLowerCase();
	} 

	return { website, streamerUsername };
}

function isWebsiteSupported(interaction, streamerUsername, website) {
	let valid = true;
	let description;
	
	if(website === "") {
		description = 'Invalid/Unsupported url entered.';
		valid = false;
	} else if(streamerUsername == "") {
		description = "Username must not be empty.";
		valid = false;
	} else if(website == "twitch" && !isValidTwitchUsername(streamerUsername)){
		description = "Invalid username entered.";
		valid = false;
	} 

	if(!valid) {
		interaction.reply({ embeds : [embedHelper.createEmbed(embeddedTitle, description)]});
	}

	return valid;
}

//Checks both locally and through the api for the streamer.
async function validateStreamerExists(interaction, streamerUsername, website) {
	//Call the correct api to see if the user is real.
	let streamerId = null;
	let streamerAsJSON = null;
	let streamerDisplayName = null;
	let streamerDescription = null;
	let streamerIcon = null;

	if(website == "twitch") {
		//check local database
		streamerAsJSON = await checkTwitchStreamerExistsLocal(interaction.client, streamerUsername);
		if(streamerAsJSON == null){ //We don't have the streamer in TWITCH_STREAMERS
			({streamerId, streamerDisplayName, streamerDescription, streamerIcon}  = await checkTwitchStreamerExistsAPI(interaction.client, streamerUsername));
			if(streamerId == null || streamerId == "!error!") {
				let description = 'User does not exist.';
				interaction.reply({ embeds : [embedHelper.createEmbed(embeddedTitle, description)]});
			}				
		} else {
			streamerDisplayName = streamerAsJSON.get(`streamerDisplayName`);
			streamerId = streamerAsJSON.get(`streamerId`);
			streamerDescription = streamerAsJSON.get(`streamerDescription`);
			streamerIcon = streamerAsJSON.get(`streamerIcon`);
		}

		return { streamerAsJSON, streamerId, streamerDisplayName, streamerDescription, streamerIcon };
	}
}

async function checkTwitchStreamerExistsLocal(client, streamerUsername) {
	try {
		let ts_streamer = await client.dbs.twitchstreamers.findOne({ where: { streamerUsername: `${streamerUsername}` }});
		
		if(ts_streamer) {return ts_streamer;} 
		else {return null;}
	} catch (error) {
		console.log(`~~~~checkTwitchStreamerExistsLocal~~~~\n${error}\n`)
		return null;
	}
}

async function checkTwitchStreamerExistsAPI(client, streamerUsername) {
	try {
		let streamerId = null, streamerDisplayName = null, streamerIcon = null, streamerDescription = null;
		const user = await client.twitchAPI.users.getUserByName(`${streamerUsername}`);
		if(user) {
			streamerId = `${user.id}`;
			streamerDisplayName = user.displayName;
			streamerIcon = user.profilePictureUrl;
			streamerDescription = user.description;	
		}
		return {streamerId, streamerDisplayName, streamerDescription, streamerIcon};
	} catch (error) {
		console.log(`~~~~checkTwitchStreamerExistsAPI~~~~\n${error}\n`);
		return "!error!";
	}
	
}

