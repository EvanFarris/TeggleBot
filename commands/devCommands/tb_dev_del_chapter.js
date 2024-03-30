const { SlashCommandBuilder } = require('discord.js');
const dbHelper = require(`../../helperFiles/database_functions.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_dev_del_chapter')
		.setDescription('Delete a chapter from a manga.')
		.addStringOption(option =>
			option.setName(`url`)
			.setDescription('Url to manga series.')
			.setRequired(true))
		.addIntegerOption(option =>
			option.setName(`num`)
			.setDescription('Number of chapters to delete.')
			.setRequired(true)),
	async execute(interaction) {
		const url = interaction.options.getString(`url`).toLowerCase();
		const num = interaction.options.getInteger(`num`);
		const url_parts = url.split(/\/+/);
		if (url_parts.length < 2){
			interaction.reply("Error: Invalid url submitted.");
			return;
		}
		const [domain, identifier] = getDomainAndIdentifier(url);
		let manga_row = await dbHelper.checkLocalMangaSeries(interaction, [domain, identifier]);
		if(manga_row){
			let chapters = JSON.parse(manga_row.chapters);
			chapters = chapters.slice(Math.max(0, Math.min(num, chapters.length - 1)),chapters.length);

			await manga_row.update({chapters: JSON.stringify(chapters), numChapters: chapters.length});
			interaction.reply(`Deleted ${num} chapters, now there are ${chapters.length} chapters.`);
		} else{ interaction.reply(`No Series found.`);}
	},
	
};

function getDomainAndIdentifier(url) {
	let url_parts = url.split(/\/+/);
	let domain_index = 0;
	if(url_parts[domain_index].match(/^https?:$/)){domain_index = 1;}
	return [url_parts[domain_index], url_parts[url_parts.length - 1]];
}