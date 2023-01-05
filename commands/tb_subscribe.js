const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, InteractionType, ButtonStyle} = require('discord.js');

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
			.setRequired(true)),
	async execute(interaction) {
		if(!interaction.memberPermissions.has(`ADMINISTRATOR`) && !interaction.memberPermissions.has(`MANAGE_WEBHOOKS`)) {
			await interaction.reply('You must have either the Administrator permission or the Manage Webhooks permission to use this command.');
			return;
		}

		if(interaction.type === InteractionType.ApplicationCommand) {

			let url = interaction.options.getString('url');
			let { website, streamerUsername } = validationHelper.splitURLToComponents(url);
			//Check if we have a valid website/username combo.
			if(!validationHelper.isWebsiteSupported(interaction, streamerUsername, website)) {return;}

			const gs_tableEntry = await dbHelper.getGuildSubsTableEntry(interaction);
			//Check to see if the guild is subscribed to anyone. 
			//If they are, make sure the streamer to be added isn't already subscribed to in the local database already.
			//Also, the guild must have room to subscribe to continue.
			
			if(!dbHelper.checkGuildSubs(interaction, gs_tableEntry, streamerUsername, website, embeddedTitle)) {return;}

			const { streamerAsJSON, streamerId, streamerDisplayName } = await validationHelper.validateStreamerExists(interaction, streamerUsername, website);
			if(streamerAsJSON == null && streamerId == null) {return;}
				
			const { actionRow, replyEmbedded } = await createEmbeddedComponents(interaction, streamerUsername, website);
				
			await askGuildIfThisIsTheCorrectStreamer(interaction, actionRow, replyEmbedded);

		} else if (interaction.isButton() && interaction.customId == "tb_subscribe_yes") {
			let { streamerUsername, website, streamerId, streamerDisplayName, streamerAsJSON, gs_tableEntry } = await getFromEmbedded(interaction);

			//Update GUILD_SUBS table
			let channelId = interaction.channelId;
			let gs_succ = false, ts_succ = false;
			
			if(gs_tableEntry != null) {
				gs_succ = await dbHelper.updateGuildSubs(interaction, gs_tableEntry, streamerUsername, streamerId, website, false);					
			} else {
				gs_succ = await dbHelper.createGuildSubs(interaction, streamerUsername, streamerId, website);
			} 

			//Update TWITCH_STREAMERS table
			if(gs_succ == true) {
				ts_succ = await dbHelper.addFollowerToTwitchStreamer(interaction, streamerAsJSON, streamerId, streamerUsername, streamerDisplayName, channelId);
			} else {
				//something went wrong, twitch_subs not updated
				console.log(`Couldn's update Twitch_subs...`);
			}

			if(gs_succ == true && ts_succ == true) {
				const description = `You have successfully subscribed to ${streamerDisplayName}`; 
					
				await interaction.reply({ embeds: [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
			} else {
				const description = `Something went wrong on our end . . .`; 
					
				await interaction.reply({ embeds: [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
			}

		} else if (interaction.isButton() && interaction.customId == "tb_subscribe_no") {
			interaction.update({components: []});
		}
		
	},
	
};

async function getFromEmbedded(interaction) {
	let { website, streamerUsername } = validationHelper.splitURLToComponents(interaction.message.embeds[0].url);
	let gs_tableEntry = await dbHelper.getGuildSubsTableEntry(interaction);
	
	const { streamerAsJSON, streamerId, streamerDisplayName } = await validationHelper.validateStreamerExists(interaction, streamerUsername, website);

	return { streamerUsername, website, streamerId, streamerDisplayName, streamerAsJSON, gs_tableEntry };
}

async function createEmbeddedComponents(interaction, streamerUsername, website) {
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
	let replyEmbedded = await subHelper.createEmbeddedMessageComplicated(streamerUsername, website, interaction.client.twitchAPI);
	return { actionRow, replyEmbedded };
}

async function askGuildIfThisIsTheCorrectStreamer(interaction, actionRow, replyEmbedded) {
	try {
		await interaction.reply({ ephemeral: true, embeds: [replyEmbedded], components: [actionRow] })
			then(() => {
				setTimeout(function() {
					actionRow.components[0].setDisabled(true);
					actionRow.components[1].setDisabled(true);

					interaction.editReply({ephemeral: true, embeds: [replyEmbedded], components: [actionRow]});
				},8000)
			});
	} catch (error) {}
			
	const filter = i => i.customId == "tb_subscribe_yes" || i.customId == "tb_subscribe_no";
	const collector = interaction.channel.createMessageComponentCollector({ filter, time: 8000 });
				
	try {
		collector.on(`collect`, async i => {
			actionRow.components[0].setDisabled(true);
			actionRow.components[1].setDisabled(true);
			interaction.editReply({ephemeral: true, embeds: [replyEmbedded], components: [actionRow]});
		});
	} catch (error) {}
}