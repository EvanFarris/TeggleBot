const { SlashCommandBuilder, InteractionType, ChannelType} = require('discord.js');
const embedHelper = require(`../../helperFiles/embed_functions.js`);
const dbHelper = require(`../../helperFiles/database_functions.js`);
const validationHelper = require(`../../helperFiles/validation_functions.js`);
const embeddedTitle = `TeggleBot Change Image Results`;
module.exports = {
	data: new SlashCommandBuilder()
		.setName('change_channel')
		.setDescription(`Change the Discord channel that receives a livestream notification.`)
		.addChannelOption(option =>
			option.setName(`disc_channel`)
			.setDescription('The new Discord channel to be notified.')
			.addChannelTypes(ChannelType.GuildText)
			.setRequired(true)),
	async execute(interaction) {
		if(interaction.type === InteractionType.ApplicationCommand) {
			const newChannel = interaction.options.getChannel(`disc_channel`);
			const firstResponseMessage = `Choose the streamer to update.`;
			const gs_tableEntry = await dbHelper.getGuildSubsTableEntry(interaction.client, interaction.guildId);
			if(!gs_tableEntry){
				let description = "You are not subscribed to anyone.";
				interaction.client.guildSet.delete(interaction.guildId);
				return interaction.reply({ embeds: [embedHelper.createEmbed(embeddedTitle, description)]});
			};
			const selectMenu = embedHelper.getSelectMenu(gs_tableEntry, `change_channel`);
			
			interaction.client.mapChangesToBe.set(interaction.guildId, newChannel.id);
			let messageSent = await interaction.reply({content: firstResponseMessage, ephemeral: true, components: [selectMenu]});
			embedHelper.startCollector(interaction, `change_channel`, messageSent);
		} else if (interaction.isStringSelectMenu()){
			const selectedValue = interaction.values[0];
			const newChannel = interaction.client.mapChangesToBe.get(interaction.guildId);
			if(selectedValue == `none`) {return interaction.update({components: []});}

			//Separate the chosen option into the four required information, use it to get the table information.
			const {streamerUsername, website, streamerId, channelId} = embedHelper.decomposeSelected(selectedValue);
			const {streamerAsJSON, gs_tableEntry} = await getFromDbs(interaction, streamerUsername, website);
			let result = null;
			if(streamerAsJSON) {
				result = await dbHelper.updateProperty(interaction.client, gs_tableEntry, streamerAsJSON, interaction.guildId, channelId, streamerId, `channel`, newChannel);
			}
			let description;
			if(result) {
				description = `Channel changed successfully to <#${newChannel}>.\n`;
				if(!(await interaction.client.channels.cache.get(`${newChannel}`)).permissionsFor(interaction.client.user).has(["ViewChannel","SendMessages","EmbedLinks"])) {
					description += `Warning: This bot isn't in the new channel. Messages will not be sent unless the bot is in the new channel.`;
				}
			} else {
				description = `Channel did not change successfully.`;
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
