const { SlashCommandBuilder } = require('discord.js');
const dbHelper = require(`../../helperFiles/database_functions.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_dev_add_domain')
		.setDescription('Add a domain for ')
		.addStringOption(option =>
			option.setName(`domain_name`)
			.setDescription('Manga hosting domain that follows html structure in follow_manga.js')
			.setRequired(true)),
	async execute(interaction) {
		const url_parts = interaction.options.getString(`domain_name`).toLowerCase().split(/\/+/);
		console.log(url_parts);
		if (url_parts.length < 2){
			interaction.reply("Error: Invalid url submitted.");
			return;
		}
		
		const domainIndex = url_parts[0].match(/^https?:$/) ? 1 : 0;
		const curLength = interaction.client.domains.length;
		
		if(interaction.client.domains.has(url_parts[domainIndex])){interaction.reply(`Domain: ${url_parts[domainIndex]} already allowed.`)}
		else {await dbHelper.addMangaDomain(interaction, url_parts[domainIndex]);}

	},
	
};