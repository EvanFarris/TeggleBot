const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, InteractionType, ButtonStyle, ChannelType, ComponentType} = require('discord.js');

const wait = require(`node:timers/promises`).setTimeout;

const embeddedTitle = `TeggleBot Subscribe Results`;
const subHelper = require('../helperFiles/subscribe_helper.js');
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
			
			let url = interaction.options.getString('url');
			let channel = interaction.options.getChannel(`disc_channel`);
			let customMessage = interaction.options.getString(`message`) || "";

			let { website, streamerUsername } = validationHelper.splitURLToComponents(url);
			//Check if we have a valid website/username combo.
			if(!validationHelper.isWebsiteSupported(interaction, streamerUsername, website)) {return;}

			const gs_tableEntry = await dbHelper.getGuildSubsTableEntry(interaction.client, interaction.guildId);
			//Check to see if the guild is subscribed to anyone. 
			//If they are, make sure the streamer to be added isn't already subscribed to in the local database already.
			//Also, the guild must have room to subscribe to continue.
			
			if(!dbHelper.checkGuildSubs(interaction, gs_tableEntry, streamerUsername, website, embeddedTitle)) {return;}

			const { streamerAsJSON, streamerId, streamerDisplayName, streamerDescription, streamerIcon} = await validationHelper.validateStreamerExists(interaction, streamerUsername, website);
			if(streamerAsJSON == null && streamerId == null) {return;}
			
			await dbHelper.storeTempInfo(interaction.client, interaction.guildId, streamerUsername, channel.id, streamerId, streamerDisplayName, customMessage);	
			const { actionRow, replyEmbedded } = await createEmbeddedComponents(interaction, streamerUsername, streamerDisplayName, website, streamerDescription, streamerIcon);
				
			await askGuildIfThisIsTheCorrectStreamer(interaction, streamerUsername, actionRow, replyEmbedded);

		} else if (interaction.isButton() && interaction.customId == "tb_subscribe_yes") {
			let { streamerUsername, website, streamerId, streamerDisplayName, streamerAsJSON, gs_tableEntry, streamerDescription, streamerIcon, customMessage, channelId } = await getFromEmbedded(interaction, false);

			//Update GUILD_SUBS table
			let gs_succ = false, ts_succ = false;
			
			if(gs_tableEntry != null) {
				gs_succ = await dbHelper.updateGuildSubs(interaction, gs_tableEntry, streamerUsername, streamerId, website, channelId, false);					
			} else {
				gs_succ = await dbHelper.createGuildSubs(interaction, streamerUsername, streamerId, website, channelId);
			} 

			//Update TWITCH_STREAMERS table
			if(gs_succ == true) {
				ts_succ = await dbHelper.addFollowerToTwitchStreamer(interaction, streamerAsJSON, streamerId, streamerUsername, streamerDisplayName, channelId, streamerDescription, streamerIcon, customMessage);
			} else {
				//something went wrong, twitch_subs not updated
				console.log(`Couldn't update Twitch_subs...`);
			}

			let description;
			if(gs_succ == true && ts_succ == true) {
				description = `You have successfully subscribed to ${streamerDisplayName}`; 		
			} else {
				description = `Something went wrong on our end . . .`; 
			}
			
			interaction.reply({ embeds: [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
		} else if (interaction.isButton() && interaction.customId == "tb_subscribe_no") {
			let streamerUsername = getFromEmbedded(interaction, true);
			await dbHelper.deleteTempData(interaction.client, interaction.guildId, streamerUsername);
			interaction.update({components: []});
		}
		
	},
	
};

async function getFromEmbedded(interaction, removeTempData) {
	const previousEmbed = interaction.message.embeds[0];
	const {website, streamerUsername} = validationHelper.splitURLToComponents(previousEmbed.url);
	if(removeTempData) {return streamerUsername;}
	const streamerIcon = previousEmbed.image.url;
	const streamerDescription = previousEmbed.description;
	let {streamerDisplayName, streamerId, channelId, customMessage} = await dbHelper.getExtraSubInfo(interaction.client, interaction.guildId, streamerUsername);
	let gs_tableEntry = await dbHelper.getGuildSubsTableEntry(interaction.client, interaction.guildId);
	let streamerAsJSON = await validationHelper.checkTwitchStreamerExistsLocal(interaction.client, streamerUsername);

	return { streamerUsername, website, streamerId, streamerDisplayName, streamerAsJSON, gs_tableEntry, streamerDescription, streamerIcon, customMessage, channelId};
}

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
	let replyEmbedded = await subHelper.createEmbeddedMessageComplicated(streamerUsername, website, streamerDisplayName, streamerDescription, streamerIcon);
	return { actionRow, replyEmbedded };
}

async function askGuildIfThisIsTheCorrectStreamer(interaction, streamerUsername, actionRow, replyEmbedded) {
	try {
		await interaction.reply({ ephemeral: true, embeds: [replyEmbedded], components: [actionRow] });
	} catch (error) {}
			
	const filter = i => i.customId == "tb_subscribe_yes" || i.customId == "tb_subscribe_no";
	const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });
				
	try {
		collector.on(`collect`, async i => {
			console.log(`collector collected`);
			actionRow.components[0].setDisabled(true);
			actionRow.components[1].setDisabled(true);
			interaction.editReply({ephemeral: true, embeds: [replyEmbedded], components: [actionRow]});
		});

		collector.on(`end`, collected => {
			console.log(`collector ended`);
			if(collected.size == 0) {
				console.log(`deleting data...`);
				dbHelper.deleteTempData(interaction.client, interaction.guildId, streamerUsername);
			}
			actionRow.components[0].setDisabled(true);
			actionRow.components[1].setDisabled(true);
			interaction.editReply({ephemeral: true, embeds: [replyEmbedded], components: [actionRow]});
		});
	} catch (error) {}
}