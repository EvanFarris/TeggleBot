const { SlashCommandBuilder, InteractionType, ComponentType} = require('discord.js');

const commandName = `check_manga`;
const embedHelper = require('../../helperFiles/embed_functions.js');
const dbHelper = require(`../../helperFiles/database_functions.js`);

const embeddedTitle = `TeggleBot Check Manga Results`;
module.exports = {
	data: new SlashCommandBuilder()
		.setName(commandName)
		.setDescription('Check a manga series you follow'),
	async execute(interaction) {
		if(interaction.type === InteractionType.ApplicationCommand) {
			const gType = `manga`;
			const gs_tableEntry = await dbHelper.getGuildSubsTableEntry(interaction.client, interaction.guildId, gType);

			//If the guild isn't subscribed to anyone, return
			if(!gs_tableEntry) {
				let description = `You are not following any manga.`;
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

			const {domain, identifier} = await dbHelper.getFromMangaDbs(interaction, parseInt(selectedValue));
			const manga_row = await dbHelper.checkLocalMangaSeries(interaction, [domain, identifier]);
			interaction.client.guildSet.delete(interaction.guildId);
			if(!manga_row){return interaction.reply(`Manga series somehow doesn't exist?`);}

			const emb = embedHelper.createMangaSeriesInfo(manga_row);
			try{
				interaction.reply({embeds: [emb]});
			} catch(err){
				console.log(err);
			}
		}
	},
};
