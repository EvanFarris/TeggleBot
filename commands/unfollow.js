const { SlashCommandBuilder, InteractionType} = require('discord.js');

const embedHelper = require('../helperFiles/embed_functions.js');
const dbHelper = require(`../helperFiles/database_functions.js`);
const validationHelper = require(`../helperFiles/validation_functions.js`);
const embeddedTitle = `TeggleBot Unfollow Results`;
module.exports = {
	data: new SlashCommandBuilder()
		.setName('unfollow')
		.setDescription('Unfollow a streamer.'),
	async execute(interaction) {
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
			let {gs_tableEntry, streamerAsJSON} = await getFromDbs(interaction, streamerUsername, website);

			//Remove the streamer from the Guild's list, and then remove the guild from the streamer's list
			let succeeded = false;

			let updatedRows = await dbHelper.deleteFollowerFromGuildSubs(interaction.client, gs_tableEntry, interaction.guildId, streamerUsername, website);
			if(updatedRows == true) {
				succeeded = await dbHelper.deleteFollowerFromTwitchStreamer(interaction.client, streamerAsJSON, streamerId, channelId);
			}
			
			if(succeeded == true) {
				const description = `You have successfully unfollowed ${streamerAsJSON.get(`streamerDisplayName`)}`; 		
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
	return { gs_tableEntry, streamerAsJSON};
}
