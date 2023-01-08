
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, InteractionType, ButtonStyle, StringSelectMenuBuilder} = require('discord.js');

const subHelper = require('../helperFiles/subscribe_helper.js');
const dbHelper = require(`../helperFiles/database_functions`);
const validationHelper = require(`../helperFiles/validation_functions.js`);
const embeddedTitle = `TeggleBot Unsubscribe Results`;
module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_unsubscribe')
		.setDescription('Unsubscribe from a channel.'),
	async execute(interaction) {
		if(!interaction.memberPermissions.has(`ADMINISTRATOR`) && !interaction.memberPermissions.has(`MANAGE_WEBHOOKS`)) {
			await interaction.reply('You must have either the Administrator permission or the Manage Webhooks permission to use this command.');
			return;
		}
		
		if(interaction.type === InteractionType.ApplicationCommand) {
			const gs_tableEntry = await dbHelper.getGuildSubsTableEntry(interaction.client, interaction.guildId);
			//If the guild isn't subscribed to anyone, return
			if(!gs_tableEntry) {
				let description = `You are not subscribed to anyone.`;
				return interaction.reply({ embeds : [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
			}
			
			let row = getSelectMenu(interaction, gs_tableEntry);

			await interaction.reply({content: `Choose a person to unsubscribe from`, ephemeral: true, components: [row] });
				
		} else if(interaction.isStringSelectMenu()) {
			const selectedValue = interaction.values[0];

			if(selectedValue == `none`) {return interaction.update({components: []});}

			let {streamerUsername, website, streamerId, channelId} = decomposeSelected(selectedValue);
			//Load streamer data from embedded, streamer
			

			let {streamerAsJSON, gs_tableEntry} = await getFromDbs(interaction, streamerUsername, website);

			//Remove the streamer from the Guild's list, and then remove the guild from the streamer's list
			let succeeded = false;
			if(website == "twitch") {
				let updatedRows = await dbHelper.updateGuildSubs(interaction, gs_tableEntry, streamerUsername, streamerId, website, true);

				if(updatedRows == true) {
					succeeded = await dbHelper.deleteFollowerFromTwitchStreamer(interaction.client, streamerAsJSON, streamerId, channelId);
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

async function getFromDbs(interaction, streamerUsername, website) {
	const gs_tableEntry = await dbHelper.getGuildSubsTableEntry(interaction.client, interaction.guildId);
	let streamerAsJSON = null;
	if(gs_tableEntry) {
		if( website == "twitch" ) {
			streamerAsJSON = await validationHelper.checkTwitchStreamerExistsLocal(interaction.client, streamerUsername);
		} else if (website == "youtube") {

		}
	}
	return {streamerAsJSON, gs_tableEntry};
}

function getSelectMenu(interaction, gs_tableEntry) {
	let jsonParsed = JSON.parse(gs_tableEntry.get(`streamersInfo`));
	let names = jsonParsed.names;
	let websites = jsonParsed.websites;
	let channels = jsonParsed.channels;
	let streamerIds = jsonParsed.streamerIds;

	let selectMenuOptions = new StringSelectMenuBuilder()
		.setCustomId(`tb_unsub_select_menu`)
		.setPlaceholder(`Nothing Selected`);
	selectMenuOptions.addOptions({label: `No one`, value: `none`});
	for(i = 0; i < names.length; i++) {
		selectMenuOptions.addOptions(
		{
			label: `${names[i]} | ${websites[i]}`,
			value: `${streamerIds[i]}|${channels[i]}|${names[i]}|${websites[i]}`
		});
	}
	return (new ActionRowBuilder().addComponents(selectMenuOptions));
}

function decomposeSelected(selectedValue) {
	let pipeIndexes = selectedValue.split(`|`);
	let streamerId = pipeIndexes[0];
	let channelId = pipeIndexes[1];
	let streamerUsername = pipeIndexes[2];
	let website = pipeIndexes[3];
	return {streamerUsername, website, streamerId, channelId};
}