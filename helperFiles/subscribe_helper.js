const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const embeddedTitle = `TeggleBot Subscribe Results`;
module.exports = {
	createEmbeddedMessage,
	createEmbeddedMessageComplicated,
	getGuildSubsTableEntry
}


function createEmbeddedMessage(title, description) {
	const embeddedMessage = new EmbedBuilder()
		.setColor(`#09f`)
		.setTitle(title)
		.setDescription(description);
	return embeddedMessage;
}


async function createEmbeddedMessageComplicated(username, website, twitchAPI) {
	const embeddedMessage = new EmbedBuilder()
		.setColor(`#0099ff`)
		.setTitle(`Retrieved ${username} from the ${website} API`)
		.setDescription(`Is this the correct streamer?`);

	if(website == "twitch") {
		let streamerObject = await twitchAPI.users.getUserByName(username);
		let channelDescription = streamerObject.description;
		if(channelDescription == "") {channelDescription = " ";}
		embeddedMessage.setTitle(`Is this the correct streamer? (${username})`)
			.setImage(streamerObject.profilePictureUrl)
			.setURL(`https://twitch.tv/${username}`)
			.setDescription(channelDescription);
	} else if (website == "youtube") {

	}

	return embeddedMessage;
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

