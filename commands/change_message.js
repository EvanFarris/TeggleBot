const { SlashCommandBuilder, InteractionType} = require('discord.js');
const embedHelper = require(`../helperFiles/embed_functions.js`);
const dbHelper = require(`../helperFiles/database_functions.js`);
const validationHelper = require(`../helperFiles/validation_functions.js`);
const embeddedTitle = `TeggleBot Change Message Results`;
module.exports = {
	data: new SlashCommandBuilder()
		.setName('change_message')
		.setDescription(`Change the custom message that gets sent with a notification`)
		.addStringOption(option =>
			option.setName('message')
			.setMaxLength(256)
			.setDescription('The new message you want to send with the streamer notification.')),
	async execute(interaction) {
		if(interaction.type === InteractionType.ApplicationCommand) {
			const customMessage = interaction.options.getString(`message`) || "";
			const firstResponseMessage = `Choose the streamer to update.`;
			const gs_tableEntry = await dbHelper.getGuildSubsTableEntry(interaction.client, interaction.guildId);
			if(!gs_tableEntry){
				interaction.client.guildSet.delete(interaction.guildId);
				let description = "You are not subscribed to anyone.";
				return interaction.reply({ embeds: [embedHelper.createEmbed(embeddedTitle, description)]});
			};
			const selectMenu = embedHelper.getSelectMenu(gs_tableEntry, `change_message`);
			
			interaction.client.mapChangesToBe.set(interaction.guildId, customMessage);
			let messageSent = await interaction.reply({content: firstResponseMessage, ephemeral: true, components: [selectMenu]});
			embedHelper.startCollector(interaction, `change_message`, messageSent);
		} else if (interaction.isStringSelectMenu()){
			const selectedValue = interaction.values[0];
			const customMessage = interaction.client.mapChangesToBe.get(interaction.guildId);
			interaction.client.mapChangesToBe.delete(interaction.guildId);
			if(selectedValue == `none`) {return interaction.update({components: []});}

			//Separate the chosen option into the four required information, use it to get the table information.
			const {streamerUsername, website, streamerId, channelId} = embedHelper.decomposeSelected(selectedValue);
			const {streamerAsJSON, gs_tableEntry} = await getFromDbs(interaction, streamerUsername, website);
			let result = null;
			if(streamerAsJSON) {
				result = await dbHelper.updateProperty(interaction.client, gs_tableEntry, streamerAsJSON, interaction.guildId, channelId, streamerId, `message`, customMessage);
			}
			let description;
			if(result) {
				description = `Message changed successfully.`;
			} else {
				description = `Message did not change successfully.`;
			}
			interaction.reply({embeds: [embedHelper.createEmbed(embeddedTitle, description)]});
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
