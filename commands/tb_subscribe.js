const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, InteractionType, ButtonStyle, ChannelType, ComponentType} = require('discord.js');

const wait = require(`node:timers/promises`).setTimeout;

const embeddedTitle = `TeggleBot Subscribe Results`;
const embedHelper = require('../helperFiles/embed_helper.js');
const dbHelper = require(`../helperFiles/database_functions.js`);
const validationHelper = require(`../helperFiles/validation_functions.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_subscribe')
		.setDescription('Subscribe to a streamer.')
		.addStringOption(option =>
			option.setName('url')
			.setDescription('The url to the streamer you want to subscribe to.')
			.setRequired(true))
		.addChannelOption(option =>
			option.setName(`disc_channel`)
			.setDescription('The Discord channel to be notified.')
			.addChannelTypes(ChannelType.GuildText)
			.setRequired(true))
		.addStringOption(option =>
			option.setName('message')
			.setDescription('The message to go along with the notification')
			.setMaxLength(256)),
	async execute(interaction) {
		if(!interaction.memberPermissions.has(`ADMINISTRATOR`) && !interaction.memberPermissions.has(`MANAGE_WEBHOOKS`)) {
			await interaction.reply('You must have either the Administrator permission or the Manage Webhooks permission to use this command.');
			return;
		}

		if(interaction.type === InteractionType.ApplicationCommand) {
			//load data from the slash command
			let url = interaction.options.getString('url');
			let channel = interaction.options.getChannel(`disc_channel`);
			let customMessage = interaction.options.getString(`message`) || "";

			//Separate the url into the website and username. Then check if it is a valid combination (currently only twitch.tv links are supported)
			let { website, streamerUsername } = validationHelper.splitURLToComponents(url);
			if(!validationHelper.isWebsiteSupported(interaction, streamerUsername, website)) {return;}

			//Get gs_tableEntry for future use, and check to see if the guild is already subscribed to the streamer it's asking for.
			const gs_tableEntry = await dbHelper.getGuildSubsTableEntry(interaction.client, interaction.guildId);
			if(!dbHelper.checkGuildSubs(interaction, gs_tableEntry, streamerUsername, website, embeddedTitle)) {return;}

			//Check to see if the streamer actually exists, and retrieve relevant information if they do.
			const { streamerAsJSON, streamerId, streamerDisplayName, streamerDescription, streamerIcon} = await validationHelper.validateStreamerExists(interaction, streamerUsername, website);
			if(streamerAsJSON == null && streamerId == null) {return;}
			
			//Store the extraneous streamer's information temporarily (dbHelper's deleteTempInfo)
			await dbHelper.storeTempInfo(interaction.client, interaction.guildId, streamerUsername, channel.id, streamerId, streamerDisplayName, customMessage);	
			
			//Create the embed and ask the guild if the streamer is the right one.
			const { actionRow, replyEmbedded } = await createEmbeddedComponents(interaction, streamerUsername, streamerDisplayName, website, streamerDescription, streamerIcon);	
			await askGuildIfThisIsTheCorrectStreamer(interaction, streamerUsername, actionRow, replyEmbedded);
		} else if (interaction.isButton() && interaction.customId == "tb_subscribe_yes") {
			//This is where the code returns to if the user clicks the yes button.
			//Get the streamer's data back from the embed and the temp database.
			let { streamerUsername, website, streamerId, streamerDisplayName, streamerAsJSON, gs_tableEntry, streamerDescription, streamerIcon, customMessage, channelId } = await getFromEmbedded(interaction, false);

			//Update GUILD_SUBS table, create an entry if one doesn't exist
			let gs_succ = false, ts_succ = false;
			
			if(gs_tableEntry != null) {
				gs_succ = await dbHelper.updateGuildSubs(interaction, gs_tableEntry, streamerUsername, streamerId, website, channelId, false);					
			} else {
				gs_succ = await dbHelper.createGuildSubs(interaction, streamerUsername, streamerId, website, channelId);
			} 

			//Update TWITCH_STREAMERS table. 
			if(gs_succ == true) {
				ts_succ = await dbHelper.addFollowerToTwitchStreamer(interaction, streamerAsJSON, streamerId, streamerUsername, streamerDisplayName, channelId, streamerDescription, streamerIcon, customMessage);
			} else {
				//something went wrong, twitch_subs not updated
				console.log(`Couldn't update Twitch_subs...`);
			}

			//Final response to the user.
			let description;
			if(gs_succ == true && ts_succ == true) {
				description = `You have successfully subscribed to ${streamerDisplayName}.\nNotifications will be sent to <#${channelId}>`; 		
			} else {
				description = `Something went wrong on our end . . .`; 
			}
			
			interaction.reply({ embeds: [embedHelper.createEmbed(embeddedTitle, description)]});
		} else if (interaction.isButton() && interaction.customId == "tb_subscribe_no") {
			//Clean up the temporary table's data 
			let streamerUsername = getFromEmbedded(interaction, true);
			await dbHelper.deleteTempData(interaction.client, interaction.guildId, streamerUsername);
			interaction.update({components: []});
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
	let {streamerDisplayName, streamerId, channelId, customMessage} = await dbHelper.getTempInfo(interaction.client, interaction.guildId, streamerUsername);
	let gs_tableEntry = await dbHelper.getGuildSubsTableEntry(interaction.client, interaction.guildId);
	let streamerAsJSON = await validationHelper.checkTwitchStreamerExistsLocal(interaction.client, streamerUsername);

	return { streamerUsername, website, streamerId, streamerDisplayName, streamerAsJSON, gs_tableEntry, streamerDescription, streamerIcon, customMessage, channelId};
}

//Create the embed with the help of embedHelper.
async function createEmbeddedComponents(interaction, streamerUsername, streamerDisplayName, website, streamerDescription, streamerIcon) {
	const actionRow = new ActionRowBuilder()
		.addComponents(
				new ButtonBuilder()
					.setCustomId('tb_subscribe_yes')
					.setLabel(`Yes (Subscribe)`)
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(`tb_subscribe_no`)
					.setLabel(`No`)
					.setStyle(ButtonStyle.Secondary),
		);
	let replyEmbedded = await embedHelper.createEmbedComplicated(streamerUsername, website, streamerDisplayName, streamerDescription, streamerIcon);
	return { actionRow, replyEmbedded };
}

//Sends the message to the user, sets up a collector to restrict the interaction to only last for 15 seconds
//Also cleans up the temporary data if the button is not responded to.
async function askGuildIfThisIsTheCorrectStreamer(interaction, streamerUsername, actionRow, replyEmbedded) {
	try {
		await interaction.reply({ ephemeral: true, embeds: [replyEmbedded], components: [actionRow] });
	} catch (error) {}
			
	const filter = i => i.customId == "tb_subscribe_yes" || i.customId == "tb_subscribe_no";
	const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });
				
	try {
		collector.on(`collect`, async i => {
			actionRow.components[0].setDisabled(true);
			actionRow.components[1].setDisabled(true);
			interaction.editReply({ephemeral: true, embeds: [replyEmbedded], components: [actionRow]});
		});

		collector.on(`end`, collected => {
			if(collected.size == 0) {
				dbHelper.deleteTempData(interaction.client, interaction.guildId, streamerUsername);
			}
			actionRow.components[0].setDisabled(true);
			actionRow.components[1].setDisabled(true);
			interaction.editReply({ephemeral: true, embeds: [replyEmbedded], components: [actionRow]});
		});
	} catch (error) {}
}