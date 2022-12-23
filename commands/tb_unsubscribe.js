
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, InteractionType, ButtonStyle} = require('discord.js');

const subHelper = require('../helperFiles/subscribe_helper.js');
const dbHelper = require(`../helperFiles/database_functions`);
const validationHelper = require(`../helperFiles/validation_functions.js`);
const embeddedTitle = `TeggleBot Unsubscribe Results`;
module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_unsubscribe')
		.setDescription('Unsubscribe from a channel.')
		.addStringOption(option =>
			option.setName('url')
			.setDescription('The url to the streamer you want to unsubscribe from.')
			.setRequired(true)),
	async execute(interaction) {
		if(!interaction.memberPermissions.has(`ADMINISTRATOR`) && !interaction.memberPermissions.has(`MANAGE_WEBHOOKS`)) {
			await interaction.reply('You must have either the Administrator permission or the Manage Webhooks permission to use this command.');
			return;
		}
		if(interaction.type === InteractionType.ApplicationCommand) {
			let msg = interaction.options.getString('url');
			let { website, streamerUsername } = validationHelper.splitURLToComponents(msg);

			//Check if we have a valid website/username combo.
			if(!validationHelper.isWebsiteSupported(interaction, streamerUsername, website)) {return;}

			const gs_tableEntry = await dbHelper.getGuildSubsTableEntry(interaction);
			//If the guild isn't subscribed to anyone, return
			if(!gs_tableEntry) {
				let description = `You are not subscribed to anyone.`;
				return interaction.reply({ embeds : [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
			}
			
			//If the guild isn't subscribed to the specific person, return
			const {wasFound, streamerId} = await dbHelper.checkIfGuildIsAlreadySubscribedToStreamer(interaction, gs_tableEntry, streamerUsername, website);
			if(!wasFound) {
				let description = `You are not subscribed to this streamer.`;
				return interaction.reply({ embeds: [subHelper.createEmbeddedMessage(embeddedTitle, description)] });
			}

			let {actionRow, replyEmbedded } = await createEmbeddedComponents(interaction, streamerUsername, streamerId, website);
			await askGuildIfThisIsTheCorrectStreamer(interaction, actionRow, replyEmbedded);
				
		} else if(interaction.isButton() && interaction.customId == "tb_unsubscribe_yes") {
				
			//Load streamer data from embedded, streamer
			let { streamerUsername, website, streamerAsJSON, gs_tableEntry } = await getFromEmbedded(interaction);

			//Remove the streamer from the Guild's list, and then remove the guild from the streamer's list
			let succeeded = false;
			if(website == "twitch") {
				let { updatedRows, channelId } = await dbHelper.updateGuildSubs(interaction, gs_tableEntry, streamerUsername, streamerId, website, true);
				if(channelId != null) {
					succeeded = await dbHelper.deleteFollowerFromTwitchStreamer(interaction, streamerAsJSON, streamerAsJSON.get(`streamerId`), channelId);
				}
			
			} else if(website == "youtube") {
			} else { //Something went wrong, end the function.
					return;
			}

			if(succeeded == true) {
				const description = `You have been successfully unsubscribed from ${streamerAsJSON.get(`streamerDisplayName`)}`; 		
				return interaction.reply({ embeds: [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
			} else {
				const description = `Some voodoo magic happened, but you shouldn't be subscribed to the streamer.`;
				return interaction.reply({ embeds: [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
			}

		} else {
			interaction.reply("OK");
		}
	},
};

async function getFromEmbedded(interaction) {
	const { website, streamerUsername } = validationHelper.splitURLToComponents(interaction.message.embeds[0].url);
	const gs_tableEntry = await dbHelper.getGuildSubsTableEntry(interaction);
	let streamerAsJSON = null;
	if(gs_tableEntry) {
		if( website == "twitch" ) {
			streamerAsJSON = await validationHelper.checkTwitchStreamerExistsLocal(interaction, streamerUsername);
		} else if (website == "youtube") {

		}
	}
	return { streamerUsername, website, streamerAsJSON, gs_tableEntry };
}

async function createEmbeddedComponents(interaction, streamerUsername, streamerId, website) { 
	const actionRow = new ActionRowBuilder()
		.addComponents(
			new ButtonBuilder()
				.setCustomId('tb_unsubscribe_yes')
				.setLabel(`Yes (Unsubscribe)`)
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setCustomId(`tb_unsubscribe_no`)
				.setLabel(`No`)
				.setStyle(ButtonStyle.Secondary),
		);

	let replyEmbedded = await subHelper.createEmbeddedMessageComplicated(streamerUsername, website, interaction.client.twitchAPI);
	replyEmbedded.setFooter({text: `${streamerId}`});
	return {actionRow, replyEmbedded};
}

async function askGuildIfThisIsTheCorrectStreamer(interaction, actionRow, replyEmbedded) {
	await interaction.reply({ ephemeral: true, embeds: [replyEmbedded], components: [actionRow] })
		.then(() => {
			setTimeout(function() {
				actionRow.components[0].setDisabled(true);
				actionRow.components[1].setDisabled(true);
				interaction.editReply({ephemeral: true, embeds: [replyEmbedded], components: [actionRow]});
			},8000)
		});

	const filter = i => i.customId == "tb_unsubscribe_yes" || i.customId == "tb_unsubscribe_no";
	const collector = interaction.channel.createMessageComponentCollector({ filter, time: 8000 });
	try {
			collector.on(`collect`, async i => {
			actionRow.components[0].setDisabled(true);
			actionRow.components[1].setDisabled(true);
			interaction.editReply({ephemeral: true, embeds: [replyEmbedded], components: [actionRow]});
		});
	} catch (error) {}
}