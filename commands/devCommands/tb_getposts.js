const { SlashCommandBuilder } = require('discord.js');
const axios  = require('axios');
module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_get_posts')
		.setDescription('Manually scrape a subreddit.'),
	async execute(interaction) {
		const client = interaction.client;
		const headers = {
			'User-Agent': `TeggleBot/${client.tb_version} by ${client.redditInfo.username}`,
			'Authorization': `bearer ${client.redditInfo.token}`,
		};
		
		const options = {headers: headers};
		const url = 'https://oauth.reddit.com/r/shittyfoodporn/hot';
		try{
			const returnedInfo = (await axios.get(url, options));
			processHTTP(interaction, returnedInfo);
		} catch (err) {
			interaction.reply(`An error occurred\n\n${err}`);
		}

	},
};

function processHTTP(interaction, returnedInfo) {
	const status = returnedInfo.status;
	if(status < 200 || status > 299) {
		interaction.reply(`HTTP response status code out of bounds 200-299: ${status}\nStatus text: ${returnedInfo.statusText}`);
		return;
	}

	if(returnedInfo.data && returnedInfo.data.data && returnedInfo.data.data.children) {
		let posts = returnedInfo.data.data.children;
		console.log(`-------------`);
		console.log(posts);
		console.log('+++++++++++++');
		console.log(posts[0]);
	} else {
		console.log(`No posts?\n`);
		console.log(returnedInfo);
	}
	
	interaction.reply("Check console!");
}