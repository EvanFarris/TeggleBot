const { SlashCommandBuilder, InteractionType} = require('discord.js');
const embedHelper = require(`../helperFiles/embed_functions.js`);
const dbHelper = require(`../helperFiles/database_functions.js`);
const validationHelper = require(`../helperFiles/validation_functions.js`);
const embeddedTitle = `TeggleBot Change Image Results`;
module.exports = {
	data: new SlashCommandBuilder()
		.setName('change_image')
		.setDescription(`Change the image that gets sent with a streamer went live notification`)
		.addStringOption(option =>
			option.setName('image')
			.setMaxLength(256)
			.setDescription('The direct link you want to send with the streamer notification.')),
	async execute(interaction) {
		if(interaction.type === InteractionType.ApplicationCommand) {
			const customImage = interaction.options.getString(`image`) || null;
			const firstResponseMessage = `Choose the streamer to update.`;
			const gs_tableEntry = await dbHelper.getGuildSubsTableEntry(interaction.client, interaction.guildId);
			if(!gs_tableEntry){
				interaction.client.guildSet.delete(interaction.guildId);
				let description = "You are not subscribed to anyone.";
				return interaction.reply({ embeds: [embedHelper.createEmbed(embeddedTitle, description)]});
			};
			const selectMenu = embedHelper.getSelectMenu(gs_tableEntry, `change_image`);
			
			interaction.client.mapChangesToBe.set(interaction.guildId, customImage);
			let messageSent = await interaction.reply({content: firstResponseMessage, ephemeral: true, components: [selectMenu]});
			embedHelper.startCollector(interaction, `change_image`, messageSent);
		} else if (interaction.isStringSelectMenu()){
			const selectedValue = interaction.values[0];
			const customImage = interaction.client.mapChangesToBe.get(interaction.guildId);
			interaction.client.mapChangesToBe.delete(interaction.guildId);
			if(selectedValue == `none`) {return interaction.update({components: []});}

			//Separate the chosen option into the four required information, use it to get the table information.
			const {streamerUsername, website, streamerId, channelId} = embedHelper.decomposeSelected(selectedValue);
			const {streamerAsJSON, gs_tableEntry} = await getFromDbs(interaction, streamerUsername, website);
			let result = null;
			if(streamerAsJSON) {
				result = await dbHelper.updateProperty(interaction.client, gs_tableEntry, streamerAsJSON, interaction.guildId, channelId, streamerId, `image`, customImage);
			}
			let description;
			if(result) {
				description = `Image changed successfully.`;
			} else {
				description = `Image did not change successfully.`;
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
