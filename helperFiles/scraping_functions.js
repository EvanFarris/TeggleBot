const { parse } = require('node-html-parser');
const embedHelper = require('./embed_functions.js');
const axios  = require('axios');

module.exports = {
	jobTester,
	refreshMangaDB,
	scrapeAndProcessURL,
	sendRedditMessages,
	getNewRedditToken,
}

async function refreshMangaDB(client) {
	const allManga = await client.dbs.mangaseries.findAll();
	let url, guilds;
	for(const manga of allManga) {
		url = `https://${manga.domain}/`;
		if(manga.pathPrefix.length > 0){url += `${manga.pathPrefix}/`;}
		url += `${manga.identifier}/`;

		const {title, image: newImage, chapters: newChapters} = await scrapeAndProcessURL(null, url);
		if(title == null) {
			console.log(`url not working - ${url}\n`);
			continue;
		}

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
						} catch(err){
							console.log(err);
						}
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
		if(interaction){interaction.reply(`Url given does not lead to a page with series information.`);}
		else{console.log(`Url given does not lead to a page with series information`);}
		return null;
	}

	//Extract the image
	let image = parsed.querySelector(`div.manga-info-pic > img`);
	if(!image){image = parsed.querySelector(`span.info-image > img`);}
	if(image){image = image.getAttribute(`src`);}

	//Extract the chapters
	let chapter_list = parsed.querySelector(`ul.row-content-chapter`);

	//return Array of Arrays which holds chapter data
	let chapters = [];
	let chapters_set = new Set();
	let link, link_parts, chapter_name, date;
	//Populate chapters array depending on html structure, or reply to interaction/console if it doesnt find any list of chapters..
	if(chapter_list) {	
		chapter_list = chapter_list.querySelectorAll('li');
		//Separate the list items into an array of strings containing chapter data
		for (const li of chapter_list) {
			link  			= li.querySelector('a.chapter-name.text-nowrap').getAttribute('href');
			chapter_name 	= li.querySelector('a.chapter-name.text-nowrap').childNodes[0]._rawText;
			date 			= li.querySelector(`span.chapter-time.text-nowrap`).getAttribute('title');
			
			if(link) {
				link_parts 	= link.split(/\/+/);
				link 		= link_parts[link_parts.length - 1];
			}
			
			//Removes HH:MM from string if uploaded on a previous date.
			if(date && /^\D/.test(date)){date = date.substring(0, date.length - 6);}
			
			//Stops duplicate links from being added, ensures only chapters with links are added to array.
			if(link && !chapters_set.has(link)){
				chapters.push([chapter_name, link, date]);
				chapters_set.add(link);
			}
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

			if(link && !chapters_set.has(link)){
				chapters.push([chapter_name, link, date]);
				chapters_set.add(link);
			}
		}
	} else {
		if(interaction){interaction.reply('Series has either no chapters out, or an unexpected html structure. Message bot maintainer if there are chapters.');}
		else{console.log('Series has either no chapters out, or an unexpected html structure. Message bot maintainer if there are chapters.');}
		
		return {title: null, image: null, chapters: null};
	}

	return {title: title, image: image, chapters: chapters};
}

//Reddit Functions
async function sendRedditMessages(client) {
	return;
	const curTime = Date.now();

	//Refresh API token if it expired
	if(client.redditInfo.expires <= curTime) {await getNewRedditToken(client);}
	if(client.redditInfo.token == null) {return console.log(`sendRedditMessages - no token after refresh`);}

	const headers = {
		'User-Agent': `TeggleBot/${client.tb_version} by ${client.redditInfo.username}`,
		'Authorization': `bearer ${client.redditInfo.token}`,
	};
	const options = {headers: headers};

	let url, guilds;
	for (const subreddit of allSubreddits) {
		url = `https://oauth.reddit.com/r/${subreddit.name}`;
		try {
			const returnedInfo = (await axios.get(url, options));
			const posts = processData(returnedInfo);
			savePosts(client, posts);
			sendPosts(client, posts, subreddit.guildsJSON);
		} catch (err) {
			interaction.reply(`sendRedditMessages - An error occurred\n${err}`);
		}

		await sleep(1000);
	}
}

function processData(interaction, returnedInfo) {
	const status = returnedInfo.status;
	if(status < 200 || status > 299) {
		console.log(`HTTP response status code out of bounds 200-299: ${status}\nStatus text: ${returnedInfo.statusText}`);
		return null;
	}
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

async function getNewRedditToken(client) {
	const headers = {
		'User-Agent': `TeggleBot/${client.tb_version} by ${client.redditInfo.username}`
	};

	const url = 'https://www.reddit.com/api/v1/access_token';
	const params = new URLSearchParams({grant_type: `client_credentials`});
	try{
		const returnedInfo = (await axios.post(url,{}, {
			headers: headers,
			auth: {
				username: client.redditInfo.id,
				password: client.redditInfo.secret
			},
			params: params
		}));
		if(returnedInfo.status >= 200 && returnedInfo.status <= 299){
			client.redditInfo.token = returnedInfo.data.access_token;
			client.redditInfo.expires = Date.now() + returnedInfo.expires_in * 1000 - 100;
			return true;
		} else {
			return false;
		}
	} catch (err) {
		console.log(`An error occurred\n${err}`);
		return false;
	}
}