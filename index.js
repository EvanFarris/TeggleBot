require('dotenv').config();

const fs = require('node:fs');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { DISCORD_BOT_TOKEN: discordToken, TWITCH_CLIENT_ID: twitchClientId, TWITCH_CLIENT_SECRET: twitchClientSecret, TWITCH_ACCESS_TOKEN: listenerString, SEQUELIZE_USER: sq_user, SEQUELIZE_PASS: sq_pass, HOST_NAME: hName , ADAPTER_PORT: adapterPort, PATH_PREFIX: pathPrefix, DB_NAME: dbName, DB_HOST: dbHost, DB_DIALECT: dbDialect, DB_STORAGE: dbStorage, DISCORD_OWNER_ID: ownerId, REDDIT_API_ID: redditID, REDDIT_API_SECRET: redditSecret, REDDIT_API_TOKEN: redditToken, REDDIT_API_EXPIRES: redditTime, REDDIT_USERNAME: redditName} = process.env;

const Sequelize = require('sequelize');

const { ApiClient } = require('@twurple/api');
const { AppTokenAuthProvider } = require('@twurple/auth');
const { DirectConnectionAdapter, EventSubHttpListener, ReverseProxyAdapter } = require('@twurple/eventsub-http');

let forceStream = false;
let forceManga  = false;
let forceReddit = false;

const dbHelper = require(`./helperFiles/database_functions.js`);
const scHelper = require(`./helperFiles/scraping_functions.js`);
const scheduler = require('node-schedule');

async function main() {
	//Load commands into the client
	checkArgs();
	const client = new Client({ intents: [GatewayIntentBits.Guilds]});
	client.commands = new Collection();
	console.log(`Rolling out events and commands . . .`);
	const commandFiles = fs.readdirSync('./commands/unsafeCommands').filter(file => file.endsWith('.js'));
	const devFiles = fs.readdirSync(`./commands/devCommands`).filter(file => file.endsWith(`.js`));
	const safeFiles = fs.readdirSync(`./commands/safeCommands`).filter(file => file.endsWith(`.js`));
	client.safeCommands = new Set();
	client.ownerId = ownerId;

	//Load commands into the client
	for(const file of commandFiles) {
		const command = require(`./commands/unsafeCommands/${file}`);
		client.commands.set(command.data.name, command);
	}
	for(const file of devFiles) {
		const command = require(`./commands/devCommands/${file}`);
		client.commands.set(command.data.name, command);
		client.safeCommands.add(command.data.name);
	}
	for(const file of safeFiles) {
		const command = require(`./commands/safeCommands/${file}`);
		client.commands.set(command.data.name, command);
		client.safeCommands.add(command.data.name);
	}

	//Load event handlers into the client
	const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));

	for(const file of eventFiles) {
		const event = require(`./events/${file}`);
		if(event.once) {
			client.once(event.name, (...args) => event.execute(...args));
		} else {
			client.on(event.name, (...args) => event.execute(...args));
		}
	}
	console.log(`Building the database . . . `);
	//Define the sqlite file
	const sequelize = new Sequelize(dbName, sq_user, sq_pass, {
		host: dbHost,
		dialect: dbDialect,
		logging: false,
		storage: dbStorage,
	});

	//Tracks which streamers a guild is following.
	const GUILD_SUBS = sequelize.define('guild_subs', {
		guildId: {
			type: Sequelize.STRING,
			unique: true,
		},
		streamersInfo: Sequelize.TEXT,
		numStreamers: {
			type: Sequelize.INTEGER,
			defaultValue: 1,
		},
	});

	//Tracks all the streamers being followed.
	const TWITCH_STREAMERS = sequelize.define('twitch_streamers', {
		streamerId: {
			type: Sequelize.STRING,
			unique: true,
		},
		streamerUsername: Sequelize.STRING,
		streamerDisplayName: Sequelize.STRING,
		streamerDescription: Sequelize.STRING,
		streamerIcon: Sequelize.STRING,
		streamerIconLastCheckedAt: Sequelize.STRING,
		lastOnline: Sequelize.STRING, //For timed unsubscription purposes
		followersInfo: Sequelize.TEXT,	//JSON guild channelIds to send out livestream notifications.
	});

	//Holds information about the streamer temporarily, after user used /follow, but before the button press.
	const SUB_TEMP = sequelize.define(`sub_temp`, {
		guildId: Sequelize.STRING,
		streamerUsername: Sequelize.STRING,
		channelId: Sequelize.STRING,
		streamerId: Sequelize.STRING,
		streamerDisplayName: Sequelize.STRING,
		customMessage: Sequelize.STRING,
	});

	//Stores stream information to update embeds later on. 
	const STREAM_INFO = sequelize.define(`stream_info`, {
		broadcasterId: Sequelize.STRING,
		streamURL: Sequelize.STRING,
		messagePairs: Sequelize.STRING,
		isLive: Sequelize.BOOLEAN,
		streamIds: Sequelize.STRING,
		vodLinks: Sequelize.STRING,
		durations: Sequelize.STRING,
	});

	//Stores allowed domains added by tb_dev_add_domain
	const MANGA_DOMAINS = sequelize.define(`manga_domains`, {
		domain: {
			type: Sequelize.STRING,
			unique: true,
		},
	});

	//Stores information about the manga series to be followed.
	const MANGA_SERIES = sequelize.define(`manga_series`, {
		title: 		Sequelize.STRING,
		imageUrl: 	Sequelize.STRING,
		chapters: 	Sequelize.TEXT,
		numChapters:Sequelize.INTEGER,
		domain: 	Sequelize.INTEGER,
		pathPrefix: Sequelize.INTEGER,
		identifier: Sequelize.STRING,
		guildsJSON: Sequelize.TEXT, 
	});
	
	//Separate table for tracking manga. May refactor later into guild_subs.
	const MANGA_GUILD_SUBS = sequelize.define('manga_guild_subs', {
		guildId: {
			type: Sequelize.STRING,
			unique: true,
		},
		mangaInfo: Sequelize.TEXT,
		numManga: {
			type: Sequelize.INTEGER,
			defaultValue: 1,
		},
	});
	
	const EXEMPT_GUILDS = sequelize.define('manga_exempt_guilds', {
		guildId: {
			type: Sequelize.STRING,
			unique: true,
		}
	});

	const SUBREDDITS = sequelize.define('subreddits',{
		name: {
			type: Sequelize.STRING,
			unique: true,
		},

		guildsJSON: Sequelize.TEXT,
	});

	client.tb_version = "2.1.1";
	//Attach the database + tables to the discord client so the discord commands can access the related tables.
	client.dbs = sequelize;
	client.dbs.guildsubs = GUILD_SUBS;
	client.dbs.twitchstreamers = TWITCH_STREAMERS;
	client.dbs.temp = SUB_TEMP;
	client.dbs.streamtemp = STREAM_INFO;
	client.dbs.mangadomains = MANGA_DOMAINS;
	client.dbs.mangaseries = MANGA_SERIES;
	client.dbs.mangaguildsubs = MANGA_GUILD_SUBS;
	client.dbs.exemptguilds = EXEMPT_GUILDS;
	client.dbs.subreddits = SUBREDDITS;
	await client.dbs.guildsubs.sync({force: forceStream});
	await client.dbs.twitchstreamers.sync({force: forceStream});
	await client.dbs.mangadomains.sync({force: forceManga});
	await client.dbs.mangaseries.sync({force: forceManga});
	await client.dbs.mangaguildsubs.sync({force: forceManga});
	await client.dbs.exemptguilds.sync({force: forceManga && forceStream});
	await client.dbs.subreddits.sync();
	client.dbs.temp.sync({force: true});
	client.dbs.streamtemp.sync({force: true});

	//Create a map and attach it to client. TODO: Check if mapChangesToBe and guildSet are used.
	client.hmap = new Map();
	client.mapChangesToBe = new Map();
	client.guildSet = new Set();
	client.domains = new Set();
	client.mangatemp = new Map();
	client.exemptGuilds = new Set();
	
	console.log(`Starting Twitch Listeners . . .`);
	//Setup the twitch client with auto-refreshing token.
	const authProvider = new AppTokenAuthProvider(twitchClientId, twitchClientSecret);
	//minLevel: error or debug
	const apiClient = new ApiClient({ authProvider, logger: {minLevel:'error'} });
	client.twitchAPI = apiClient;

	const RPAdapter = new ReverseProxyAdapter({
		hostName: hName,
		pathPrefix: pathPrefix,
		usePathPrefixInHandlers: true,
		port: adapterPort
	});

	let secret = listenerString;
	//Unsubscribe all the events if it's passed in from the command line.
	if(forceStream) {await apiClient.eventSub.deleteAllSubscriptions();}

	const twitchListener = new EventSubHttpListener({apiClient, adapter: RPAdapter, secret, strictHostCheck: true, legacySecrets: true});
	client.twitchListener = twitchListener;

	//Add redditInfo to client
	const redditInfo = {
		id: redditID,
		secret: redditSecret,
		token: redditToken,
		expires: redditTime,
		username: redditName,
	};

	client.redditInfo = redditInfo;
	await scHelper.getNewRedditToken(client);

	//Start the two listeners.
	await dbHelper.loadExemptGuilds(client);
	await dbHelper.loadPreviousSubscriptions(client);
	await dbHelper.loadPreviousManga(client); 
	await twitchListener.start();
	await client.login(discordToken);

	console.log(`Scheduling jobs...`);
	//Start jobs which update every hour.
	const timeToUpdateRule = new scheduler.RecurrenceRule();
	timeToUpdateRule.minute = 0;
	scheduler.scheduleJob(timeToUpdateRule, function(){scHelper.refreshMangaDB(client);});
	
	timeToUpdateRule.minute = 20;
	scheduler.scheduleJob(timeToUpdateRule, function(){scHelper.sendRedditMessages(client);});

	//TODO: Add a job to refresh twitch subscriptions biweekly
	console.log(`index.js setup finished!!!`);
}

main();

function checkArgs(){
	if(process.argv.length > 2){
		for(let i = 2; i < process.argv.length; i++ ){
			switch(process.argv[i]) {
				case `--reset-manga`:
					forceManga = true;
					break;
				case `--reset-streamers`:
					forceStream = true;
					break;
				case `--reset-reddit`:
					forceReddit = true;
					break;
				case `--reset-all`:
					forceManga  = true;
					forceStream = true;
					forceReddit = true;
					break;
				default:
					console.log(`HUH - Unknown argument: ${process.argv[i]}`);
			}
		}
	}
}
