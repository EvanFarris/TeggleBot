const { SlashCommandBuilder } = require('discord.js');
const scrapingFunctions = require('./../../helperFiles/scraping_functions.js')

const {REDDIT_API_SECRET: redditSecret, REDDIT_API_ID: redditID, REDDIT_USERNAME: redditUN} = process.env;
module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_get_auth')
		.setDescription('Sets Reddit auth token manually'),
	async execute(interaction) {
		if(await scrapingFunctions.getNewRedditToken(interaction.client)) {
			interaction.reply("Token updated.");
		} else {
			interaction.reply("Token not updated.");
		}
	},
};

