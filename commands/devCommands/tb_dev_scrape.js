const { SlashCommandBuilder } = require('discord.js');
const { parse } = require('node-html-parser');
const axios  = require('axios');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_dev_scrape')
		.setDescription('Manually scrape a web page, send output to console.')
		.addStringOption(option =>
			option.setName('url')
			.setDescription('url to scrape')
			.setRequired(true)),

	async execute(interaction) {
		const client = interaction.client;
		let url = interaction.options.getString(`url`).toLowerCase();
		const headers = {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
			'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/web,image/apng,*/*,q=0.8,application/signed-exchange;v=b3;q=0.7',
			'Accept-Language':'en-US'
		}
		const options = {headers: headers};
		
		try{
			const data = (await axios.get(url, options)).data;
			processHTTP(interaction, data);
		} catch (err) {
			interaction.reply(`An error occurred\n${err}`);
		}

	},
};

function processHTTP(interaction, res) {
	if(res.statusCode < 200 || res.statusCode > 299) {
		interaction.reply(`HTTP response status code out of bounds 200-299: ${res.statusCode}`);
		return;
	}
	const parsed = parse(res);
	
	let chapter_list = parsed.querySelector(`ul.row-content-chapter`);

	let chapters = [];
	if(chapter_list) {
		let link, chapter_name, date;
		chapter_list = chapter_list.querySelectorAll('li');
		for (const li of chapter_list) {
			link  = li.querySelector('a.chapter-name.text-nowrap').getAttribute('href');
			chapter_name = li.querySelector('a.chapter-name.text-nowrap').childNodes[0]._rawText;
			date = li.querySelector(`span.chapter-time.text-nowrap`).getAttribute('title');
			date = date.substring(0, date.length - 6);
			console.log(`${link} | ${chapter_name} | ${date}`)
		}
	} else {
		console.log('No chapters');
	}

	interaction.reply("Check console!");
}