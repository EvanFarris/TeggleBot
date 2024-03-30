const {SlashCommandBuilder, InteractionType, ChannelType, ComponentType} = require('discord.js');

const embeddedTitle = `Follow Results`;
const embedHelper = require('../../helperFiles/embed_functions.js');
const dbHelper = require(`../../helperFiles/database_functions.js`);
const validationHelper = require(`../../helperFiles/validation_functions.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('follow')
		.setDescription('Follow a streamer.')
		.addStringOption(option =>
			option.setName('url')
			.setDescription('The url to the streamer you want to follow.')
			.setRequired(true))
		.addChannelOption(option =>
			option.setName(`disc_channel`)
			.setDescription('The Discord channel to be notified.')
			.addChannelTypes(ChannelType.GuildText)
			.setRequired(true))
		.addStringOption(option =>
			option.setName('message')
			.setDescription('The message to go along with the notification')
			.setMaxLength(256))
		.addStringOption(option =>
			option.setName(`image`)
			.setDescription(`Direct link to an image to be sent in the embed`)
			.setMaxLength(256)),
	async execute(interaction) {
		if(interaction.type === InteractionType.ApplicationCommand) {
			//load data from the slash command
			let url = interaction.options.getString('url');
			let channel = interaction.options.getChannel(`disc_channel`);
			let customMessage = interaction.options.getString(`message`) || "";
			let customImage = interaction.options.getString(`image`) || null;

			//Separate the url into the website and username. Then check if it is a valid combination (currently only twitch.tv links are supported)
			let { website, streamerUsername } = validationHelper.splitURLToComponents(url);
			if(!validationHelper.isWebsiteSupported(interaction, streamerUsername, website)) {return interaction.client.guildSet.delete(interaction.guildId);}

			//Get gs_tableEntry for future use, and check to see if the guild is already subscribed to the streamer it's asking for.
			const gs_tableEntry = await dbHelper.getGuildSubsTableEntry(interaction.client, interaction.guildId);
			if(!(await dbHelper.checkGuildSubs(interaction, gs_tableEntry, streamerUsername, website, embeddedTitle))) {return interaction.client.guildSet.delete(interaction.guildId);}

			//Check to see if the streamer actually exists, and retrieve relevant information if they do.
			const { streamerAsJSON, streamerId, streamerDisplayName, streamerDescription, streamerIcon} = await validationHelper.validateStreamerExists(interaction, streamerUsername, website);
			if(streamerAsJSON == null && streamerId == null) {return interaction.client.guildSet.delete(interaction.guildId);}
			
			//Store the extraneous streamer's information temporarily (dbHelper's deleteTempInfo)
			await dbHelper.addTempInfo(interaction.client, interaction.guildId, channel.id, streamerId, streamerUsername, streamerDisplayName, customMessage, customImage);	
			
			//Create the embed and ask the guild if the streamer is the right one.
			const streamerInfo = {
				username: streamerUsername,
				displayname: streamerDisplayName,
				description: streamerDescription,
				icon: streamerIcon
			}
			const { actionRow, embedToSend } = await embedHelper.createEmbedWithButtons(interaction, streamerInfo, `follow`, `button_no_streamer`);	
			await askGuildIfThisIsTheCorrectStreamer(interaction, streamerUsername, actionRow, embedToSend);
		} else if (interaction.isButton()) {
			//This is where the code returns to if the user clicks the yes button.
			//Get the streamer's data back from the embed and the temp database.
			let { gs_tableEntry, streamerAsJSON, channelId, streamerId, streamerUsername, streamerDisplayName, streamerDescription, streamerIcon, customMessage, customImage, website } = await getFromEmbedded(interaction, false);

			//Update GUILD_SUBS table, create an entry if one doesn't exist
			let gs_succ = false, ts_succ = false;
			gs_succ = await dbHelper.addFollowerToGuildSubs(interaction.client, gs_tableEntry, interaction.guildId, channelId, streamerId, streamerUsername, streamerDisplayName, customMessage, customImage, website);

			//Update TWITCH_STREAMERS table. 
			if(gs_succ == true) {
				ts_succ = await dbHelper.addFollowerToTwitchStreamer(interaction.client, streamerAsJSON, channelId, streamerId, streamerUsername, streamerDisplayName, streamerDescription, streamerIcon, customMessage, customImage);
			} else {
				//something went wrong, twitch_subs not updated
				console.log(`Couldn't update Twitch_subs...`);
			}

			//Final response to the user.
			let description;
			if(gs_succ == true && ts_succ == true) {
				description = `You have successfully followed ${streamerDisplayName}.\nNotifications will be sent to <#${channelId}>\n`;
				if(!(await interaction.client.channels.cache.get(`${channelId}`)).permissionsFor(interaction.client.user).has(["ViewChannel","SendMessages","EmbedLinks"])) {
					description += `Warning: This bot isn't in the new channel. Messages will not be sent unless the bot is in the new channel.`;
				} 		
			} else {
				description = `Something went wrong on our end . . .`; 
			}

			interaction.reply({ embeds: [embedHelper.createEmbed(embeddedTitle, description)]});
		}
		
	},
	
};

//Get data about the streamer from the embed and the temporary table, and return it to the execute function.
async function getFromEmbedded(interaction, removeTempData) {
	const previousEmbed = interaction.message.embeds[0];
	const {website, streamerUsername} = validationHelper.splitURLToComponents(previousEmbed.url);
	if(removeTempData) {return streamerUsername;}
	const streamerIcon = previousEmbed.image.url;
	const streamerDescription = previousEmbed.description;
	let {channelId, streamerId, streamerDisplayName, customMessage, customImage} = await dbHelper.getTempInfo(interaction.client, interaction.guildId, streamerUsername);
	let gs_tableEntry = await dbHelper.getGuildSubsTableEntry(interaction.client, interaction.guildId);
	let streamerAsJSON = await validationHelper.checkTwitchStreamerExistsLocal(interaction.client, streamerUsername);

	return { gs_tableEntry, streamerAsJSON, channelId, streamerId, streamerUsername, streamerDisplayName, streamerDescription, streamerIcon, customMessage, customImage, website };
}

//Sends the message to the user, sets up a collector to restrict the interaction to only last for 15 seconds
//Also cleans up the temporary data if the button is not responded to.
async function askGuildIfThisIsTheCorrectStreamer(interaction, streamerUsername, actionRow, embedToSend) {
	let messageSent;
	try {
		messageSent = await interaction.reply({ ephemeral: true, embeds: [embedToSend], components: [actionRow] });
	} catch (error) {console.log(error);}
	
	await embedHelper.startCollector(interaction, `follow`, messageSent, ComponentType.Button, dbHelper, actionRow, embedToSend, streamerUsername);
}
