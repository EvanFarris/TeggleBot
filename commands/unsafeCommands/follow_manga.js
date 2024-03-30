const { SlashCommandBuilder, ChannelType, InteractionType, ComponentType } = require('discord.js');

const embedHelper = require('../../helperFiles/embed_functions.js');
const dbHelper = require(`../../helperFiles/database_functions.js`);
const scrapeHelper = require(`../../helperFiles/scraping_functions.js`);
const commandName = "follow_manga";

module.exports = {
	data: new SlashCommandBuilder()
		.setName('follow_manga')
		.setDescription('Have a message sent when a new chapter gets released. Only certain websites allowed')
		.addStringOption(option =>
			option.setName('url')
			.setDescription('Link to the series page.')
			.setRequired(true))
		.addChannelOption(option =>
			option.setName(`disc_channel`)
			.setDescription('The Discord channel to be notified.')
			.addChannelTypes(ChannelType.GuildText)
			.setRequired(true))
		.addStringOption(option =>
			option.setName('message')
			.setDescription('The message to go along with the notification. Max length: 256 characters')
			.setMaxLength(256)),

	async execute(interaction) {
		if(interaction.type === InteractionType.ApplicationCommand){
			executeCommand(interaction);
		} else if (interaction.isButton){
			executeButton(interaction);
		} else {
			interaction.reply("Unknown Interaction found");
		}
	},
};

async function executeCommand(interaction) {
	const url = interaction.options.getString('url').toLowerCase();

	//Validates url, checks if guild is already following the manga, and if they can follow another manga.
	if(!(await dbHelper.mangaPreChecks(interaction, getDomainAndIdentifier(url), url))){return null;}
	//check local db to see if the manga exists, returns dbRow || null.
	let series_info = await dbHelper.checkLocalMangaSeries(interaction, getDomainAndIdentifier(url));
	//if the manga series is not found locally, scrape the website for the information
	if(!series_info){
		series_info = await scrapeHelper.scrapeAndProcessURL(interaction, url);
		//{title, image, chapters} || null
	} else {
		//Before the following change to series_info, series_info is a sequelize database entry.
		//We don't need to store that, as we will be checking the db again in executeButton- in case the row was deleted from another guild.
		//So extract only the necessary info.
		series_info = {
			title: 		series_info.get(`title`),
			image: 		series_info.get(`imageUrl`),
			chapters: 	series_info.get(`chapters`),
		}
	}
	//If the series is found, ask the user if it's correct. Processing continues in executeButton, if it is the correct series.
	if(series_info) {
		//Add info to series_info for the database and embed to store in the mangatemp map
		const [domain, identifier] = getDomainAndIdentifier(url);
		series_info.domain = domain;
		series_info.identifier = identifier;
		series_info.url = url;
		series_info.guildId = interaction.guildId;
		series_info.channelId = interaction.options.getChannel(`disc_channel`).id;
		series_info.channelMessage = interaction.options.getString(`message`) || "";
		await askUserForConfirmation(interaction, series_info);
	} else {interaction.client.guildSet.delete(interaction.guildId);}	
}

async function executeButton(interaction) {
	if(interaction.client.mangatemp.has(interaction.guildId)){
		//Should have the url, domain, identifier, guildId, channelId, channelMessage, title, image, and chapters in temp_info
		const temp_info = interaction.client.mangatemp.get(interaction.guildId);
		const series_db_entry = await dbHelper.checkLocalMangaSeries(interaction, [temp_info.domain, temp_info.identifier]);
		const mgs_table_entry = await dbHelper.getMangaGuildSubsTableEntry(interaction);

		let succ, msucc = null;
		if(mgs_table_entry){succ = await dbHelper.addMangaToMGS(interaction, temp_info, mgs_table_entry);}
		else{succ = await dbHelper.createMangaGuildSubsTableEntry(interaction, temp_info);}
		if(!succ){return;}

		//If we follow the manga for someone else, add the user to it, otherwise create new manga db entry.
		if(series_db_entry){msucc = await dbHelper.addUserToMangaSeries(interaction, series_db_entry, temp_info);}
		else if (succ) {msucc = await dbHelper.createMangaSeries(interaction, temp_info);}
		
		let description;
		if(msucc != null){
			description = `You have successfully followed ${temp_info.title}.\nNotifications will be sent to <#${temp_info.channelId}>\n`;
			if(!(await interaction.client.channels.cache.get(`${temp_info.channelId}`)).permissionsFor(interaction.client.user).has(["ViewChannel","SendMessages","EmbedLinks"])) {
				description += `Warning: This bot isn't in the new channel. Messages will not be sent unless the bot is in the new channel.`;
			} 	
			interaction.reply({ embeds: [embedHelper.createEmbed(commandName +  ` results`, description)]});
		} else {
			interaction.reply(`Something went wrong on our end...`);
		}
		interaction.client.mangatemp.delete(interaction.guildId);
	}
	
}

//Only called after it's validated, used for local db check
function getDomainAndIdentifier(url) {
	let url_parts = url.split(/\/+/);
	let domain_index = 0;
	if(url_parts[domain_index].match(/^https?:$/)){domain_index = 1;}
	return [url_parts[domain_index], url_parts[url_parts.length - 1]];
}

async function askUserForConfirmation(interaction, series_info) {
	//Create embed
	const {actionRow, embedToSend} = embedHelper.createEmbedWithButtons(interaction, series_info, commandName, `button_no_manga`);
	//Save local temporary data
	interaction.client.mangatemp.set(interaction.guildId, series_info);
	//Send embed with collectors
	let messageSent = await interaction.reply({ephemeral: true, embeds: [embedToSend] , components: [actionRow]});
	await embedHelper.startCollector(interaction, commandName, messageSent, ComponentType.Button, dbHelper, actionRow, embedToSend);
	//Button interaction handles the rest.
}