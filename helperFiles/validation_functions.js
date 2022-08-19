const subHelper = require(`./subscribe_helper.js`);
const embeddedTitle = `TeggleBot Subscribe Results`;
module.exports = {
	isValidTwitchUsername,
	checkUrl,
	checkTwitchStreamerExistsLocal,
	validateUserExists,
	checkTwitchStreamerExistsAPI
}

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

async function validateUserExists(interaction, username, website) {
	//Call the correct api to see if the user is real.
	let streamerId = null;
	let streamer = null;
	if(website == "twitch") {
		//check local database
		streamer = await checkTwitchStreamerExistsLocal(interaction, username);
		if(streamer == null){ //We don't have the streamer in TWITCH_STREAMERS
			streamerId = await checkTwitchStreamerExistsAPI(interaction.client, username);
			if(streamerId == null || streamerId == "!error!") {
				let description = 'User does not exist.';
				interaction.reply({ embeds : [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
			}				
		}

		return { streamer, streamerId };
	} else if(website == "youtube") {
		//TODO: Youtube implementation
		return { streamer, streamerId };
	}
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
			return null;
		}
	} catch (error) {
		console.log(`~~~~checkTwitchStreamerExistsAPI~~~~\n${error}\n`);
		return "!error!";
	}
	
}
