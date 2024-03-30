const { parse } = require('node-html-parser');
const embedHelper = require('./embed_functions.js');
const axios  = require('axios');
module.exports = {
	scrapeAndProcessURL,
	refreshMangaDB,
	jobTester
}

async function refreshMangaDB(client) {
	const allManga = await client.dbs.mangaseries.findAll();
	let url, guilds;
	for(const manga of allManga) {
		url = `https://${manga.domain}/`;
		if(manga.pathPrefix.length > 0){url += `${manga.pathPrefix}/`;}
		url += `${manga.identifier}`;
		const {title, image: newImage, chapters: newChapters} = await scrapeAndProcessURL(null, url);
		let channel, content;
		if(manga.numChapters != newChapters.length){
			try{
				const diff = newChapters.length - manga.numChapters;
				await manga.update({chapters: JSON.stringify(newChapters), numChapters: newChapters.length, image: newImage});
				const emb = embedHelper.createNewMangaEmbed(title, url, newImage, diff, newChapters.slice(0,Math.min(Math.max(0, diff), 5)));
				for (const guildInfo of JSON.parse(manga.get(`guildsJSON`))) {
					channel = await client.channels.fetch(guildInfo.channelId);
					//If the channel exists, and the bot is in the channel and can send messages, then proceed.
					if(channel && channel.permissionsFor(client.user).has(["ViewChannel","SendMessages","EmbedLinks"])) {
						if(guildInfo.channelMessage.length != 0) {content = guildInfo.channelMessage;}
						else {content = ``;}
						try {
							messageSent = await channel.send({content: content, embeds: [emb]});
						} catch(err){}
					}
				}
			
			} catch(err){
				console.log(`refreshMangaDB: ${err}`);
			}
		}
		await sleep(1000);
	}
}

async function scrapeAndProcessURL(interaction, url) {
	const headers = {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
		'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/web,image/apng,*/*,q=0.8,application/signed-exchange;v=b3;q=0.7',
		'Accept-Language':'en-US'
	}
	const options = {headers: headers};
	
	try{
		const data = (await axios.get(url, options)).data;
		return processHTTP(interaction, data);
	} catch (err) {
		if(interaction != null){interaction.reply(`Error - scrapeAndProcessURL: ${err}`);}
		else{console.log(`Error - scrapeAndProcessURL: ${err}`);}
		return null;
	}
}

function processHTTP(interaction, data) {
	//Check if we get a webpage back
	if(data.statusCode < 200 || data.statusCode > 299) {
		if(interaction){interaction.reply(`HTTP response status code out of bounds 200-299: ${data.statusCode}`);}
		else{console.log(`HTTP response status code out of bounds 200-299: ${data.statusCode}`);}
		return null;
	}
	
	//Feed the page data into node-html-parser
	const parsed = parse(data);
	
	//Extract the title
	let title = parsed.querySelector(`h1`);
	if(title){title = title.childNodes[0]._rawText;}
	else {
		if(interaction){interaction.reply(`Url given does not lead to a page with series information`);}
		else{console.log(`Url given does not lead to a page with series information`);}
		return null;
	}

	//Extract the image
	let image = parsed.querySelector(`div.manga-info-pic > img`);
	if(!image){image = parsed.querySelector(`span.info-image > img`);}
	if(image){image = image.getAttribute(`src`);}

	//Extract the chapters
	let chapter_list = parsed.querySelector(`ul.row-content-chapter`);

	let chapters = [];
	let link, link_parts, chapter_name, date;
	//Populate chapters from two different html layouts have been found for series pages.
	if(chapter_list) {	
		chapter_list = chapter_list.querySelectorAll('li');
		for (const li of chapter_list) {
			link  			= li.querySelector('a.chapter-name.text-nowrap').getAttribute('href');
			chapter_name 	= li.querySelector('a.chapter-name.text-nowrap').childNodes[0]._rawText;
			date 			= li.querySelector(`span.chapter-time.text-nowrap`).getAttribute('title');
			
			if(link) {
				link_parts 	= link.split(/\/+/);
				link 		= link_parts[link_parts.length - 1];
			}
			if(date && /^\D/.test(date)){date = date.substring(0, date.length - 6);}
			
			chapters.push([chapter_name, link, date]);
		}
	} else if(parsed.querySelectorAll('div.chapter-list > div.row').length){
		chapter_list = parsed.querySelectorAll('div.chapter-list > div.row');
		
		for(const div of chapter_list) {
			link 			= div.querySelector(`span > a`);
			chapter_name 	= div.querySelector('span > a');
			date 			= div.querySelector(`span[title]`);
			
			if(link){
				link 		= link.getAttribute(`href`);
				link_parts 	= link.split(/\/+/);
				link 		= link_parts[link_parts.length - 1];
			}
			if(chapter_name){chapter_name = chapter_name.childNodes[0]._rawText;}
			if(date){
				date 		= date.getAttribute('title')
				if(/^\D/.test(date)){date = date.substring(0, date.length - 6);}
			}

			chapters.push([chapter_name, link, date]);
		}
	} else {
		if(interaction){interaction.reply('Series has either no chapters out, or an unexpected html structure. Message bot maintainer if there are chapters.');}
		else{console.log('Series has either no chapters out, or an unexpected html structure. Message bot maintainer if there are chapters.');}
		
		return null;
	}

	return {title: title, image: image, chapters: chapters};
}

function sleep(ms) {
	return new Promise((resolve)=> {
		setTimeout(resolve, ms);
	});
}

function jobTester(client) {
	const date = new Date();
	console.log(`Refreshing DB! ${date}`);

}