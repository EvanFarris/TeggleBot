const { SlashCommandBuilder, InteractionType, ComponentType} = require('discord.js');

const commandName = `unfollow`;
const embedHelper = require('../../helperFiles/embed_functions.js');
const dbHelper = require(`../../helperFiles/database_functions.js`);
const validationHelper = require(`../../helperFiles/validation_functions.js`);
const embeddedTitle = `TeggleBot Unfollow Results`;
module.exports = {
	data: new SlashCommandBuilder()
		.setName(commandName)
		.setDescription('Unfollow a streamer.')
		.addStringOption(option => 
			option.setName(`type`)
				.setDescription(`Stop following a streamer or a manga`)
				.setRequired(true)
				.addChoices(
					{name: `Manga`, value: `manga`},
					{name: `Streamer`, value: `streamer`},
					)),
	async execute(interaction) {
		if(interaction.type === InteractionType.ApplicationCommand) {
			const gType = interaction.options.getString(`type`);
			const gs_tableEntry = await dbHelper.getGuildSubsTableEntry(interaction.client, interaction.guildId, gType);

			//If the guild isn't subscribed to anyone, return
			if(!gs_tableEntry) {
				let gTypePlural = gType == 'streamer' ? `streamers` : `manga`;
				let description = `You are not following any ${gTypePlural}.`;
				interaction.client.guildSet.delete(interaction.guildId);
				return interaction.reply({ embeds : [embedHelper.createEmbed(embeddedTitle, description)]});
			}

			//Create the select menu to display
			let selectMenu = embedHelper.getSelectMenu(gs_tableEntry, commandName, gType);
			let messageSent = await interaction.reply({content: `Choose an option `, ephemeral: true, components: [selectMenu] });
			embedHelper.startCollector(interaction, commandName, messageSent, ComponentType.StringSelect);
		} else if(interaction.isStringSelectMenu()) {
			const selectedValue = interaction.values[0];
			
			if(selectedValue == `-1`) {
				interaction.client.guildSet.delete(interaction.guildId);
				return interaction.update({components: []});
			}
			
			let unfollowedFrom, succeeded = false;
			const split = selectedValue.split(`|`);
			if(split[split.length - 1] == "streamer") {
				//Separate the chosen option into the four required information, use it to get the table information.
				let {streamerUsername, website, streamerId, channelId} = embedHelper.decomposeSelected(selectedValue);
				let {gs_tableEntry, streamerAsJSON} = await getFromDbs(interaction, streamerUsername, website);
				unfollowedFrom = streamerUsername;

				//Remove the streamer from the Guild's list, and then remove the guild from the streamer's list
				let updatedRows = await dbHelper.deleteFollowerFromGuildSubs(interaction.client, gs_tableEntry, interaction.guildId, streamerUsername, website);
				if(updatedRows == true) {
					succeeded = await dbHelper.deleteFollowerFromTwitchStreamer(interaction.client, streamerAsJSON, streamerId, channelId);
				}
			} else if(split[split.length - 1] == "manga") {
				let {mgs_te, title, domain, identifier} = await dbHelper.getFromMangaDbs(interaction, parseInt(selectedValue));
				let updatedRows = await dbHelper.deleteFollowerFromMangaGuildSubs(mgs_te, parseInt(selectedValue));
				unfollowedFrom = title;
				if(updatedRows == true) {
					succeeded = await dbHelper.deleteFollowerFromMangaSeries(interaction.client.dbs.mangaseries, interaction.guildId, domain, identifier);
				}
			} else {
				interaction.client.guildSet.delete(interaction.guildId);
				return interaction.reply(`Unknown type returned.`);
			}

			interaction.client.guildSet.delete(interaction.guildId);
			if(succeeded == true) {
				const description = `You have been unfollowed from: ${unfollowedFrom}`; 		
				return interaction.reply({ embeds: [embedHelper.createEmbed(embeddedTitle, description)]});
			} else {
				const description = `Some voodoo magic happened, but you shouldn't be following ${unfollowedFrom}`;
				return interaction.reply({ embeds: [embedHelper.createEmbed(embeddedTitle, description)]});
			} 
		}
	},
};
