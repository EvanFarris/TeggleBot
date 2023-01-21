const { SlashCommandBuilder, InteractionType} = require('discord.js');

const embedHelper = require('../helperFiles/embed_functions.js');
const dbHelper = require(`../helperFiles/database_functions.js`);
const validationHelper = require(`../helperFiles/validation_functions.js`);
const embeddedTitle = `TeggleBot Unsubscribe Results`;
module.exports = {
	data: new SlashCommandBuilder()
		.setName('unfollow')
		.setDescription('Unfollow a streamer.'),
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
				return interaction.reply({ embeds : [embedHelper.createEmbed(embeddedTitle, description)]});
			}

			//Create the select menu to display
			let selectMenu = embedHelper.getSelectMenu(gs_tableEntry, `unfollow_select_menu`);

			interaction.reply({content: `Choose a person to unsubscribe from`, ephemeral: true, components: [selectMenu] });
				
		} else if(interaction.isStringSelectMenu()) {
			const selectedValue = interaction.values[0];

			if(selectedValue == `none`) {return interaction.update({components: []});}

			//Separate the chosen option into the four required information, use it to get the table information.
			let {streamerUsername, website, streamerId, channelId} = embedHelper.decomposeSelected(selectedValue);
			let {streamerAsJSON, gs_tableEntry} = await getFromDbs(interaction, streamerUsername, website);

			//Remove the streamer from the Guild's list, and then remove the guild from the streamer's list
			let succeeded = false;
			if(website == "twitch") {
				let updatedRows = await dbHelper.updateGuildSubs(interaction, gs_tableEntry, streamerUsername, null, streamerId, website, channelId, true);
				if(updatedRows == true) {
					succeeded = await dbHelper.deleteFollowerFromTwitchStreamer(interaction.client, streamerAsJSON, streamerId, channelId);
				}

			} else { //Something went wrong, end the function.
					return;
			}

			if(succeeded == true) {
				const description = `You have been successfully unsubscribed from ${streamerAsJSON.get(`streamerDisplayName`)}`; 		
				return interaction.reply({ embeds: [embedHelper.createEmbed(embeddedTitle, description)]});
			} else {
				const description = `Some voodoo magic happened, but you shouldn't be subscribed to the streamer.`;
				return interaction.reply({ embeds: [embedHelper.createEmbed(embeddedTitle, description)]});
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
		}
	}
	return {streamerAsJSON, gs_tableEntry};
}
