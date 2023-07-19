require('dotenv').config();

const fs = require('node:fs');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { DISCORD_BOT_TOKEN: discordToken, TWITCH_CLIENT_ID: twitchClientId, TWITCH_CLIENT_SECRET: twitchClientSecret, TWITCH_ACCESS_TOKEN: listenerString, SEQUELIZE_USER: sq_user, SEQUELIZE_PASS: sq_pass, HOST_NAME: hName , ADAPTER_PORT: adapterPort, PATH_PREFIX: pathPrefix, DB_NAME: dbName, DB_HOST: dbHost, DB_DIALECT: dbDialect, DB_STORAGE: dbStorage} = process.env;

const Sequelize = require('sequelize');

const { ApiClient } = require('@twurple/api');
const { AppTokenAuthProvider } = require('@twurple/auth');
const { DirectConnectionAdapter, EventSubHttpListener, ReverseProxyAdapter } = require('@twurple/eventsub-http');

const force = process.env.npm_config_force || false;
const dbHelper = require(`./helperFiles/database_functions.js`);

async function main() {
	//Load commands into the client
	const client = new Client({ intents: [GatewayIntentBits.Guilds]});
	client.commands = new Collection();
	console.log(`Rolling out events and commands . . .`);
	const commandFiles = fs.readdirSync('./commands/unsafeCommands').filter(file => file.endsWith('.js'));
	const devFiles = fs.readdirSync(`./commands/devCommands`).filter(file => file.endsWith(`.js`));
	const safeFiles = fs.readdirSync(`./commands/safeCommands`).filter(file => file.endsWith(`.js`));
	client.safeCommands = new Set();

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

	//create the four tables needed.
	const GUILD_SUBS = sequelize.define('guild_subs', {
		guildId: {
			type: Sequelize.STRING,
			unique: true,
		},
		streamersInfo: Sequelize.TEXT,
		numStreamers: {
			type: Sequelize.INTEGER,
			defaultValue: 1,
			allowNull: false,
		},
	});

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

	const SUB_TEMP = sequelize.define(`sub_temp`, {
		guildId: Sequelize.STRING,
		streamerUsername: Sequelize.STRING,
		channelId: Sequelize.STRING,
		streamerId: Sequelize.STRING,
		streamerDisplayName: Sequelize.STRING,
		customMessage: Sequelize.STRING,
	});

	const STREAM_INFO = sequelize.define(`stream_info`, {
		broadcasterId: Sequelize.STRING,
		streamURL: Sequelize.STRING,
		messagePairs: Sequelize.STRING,
		isLive: Sequelize.BOOLEAN,
		streamIds: Sequelize.STRING,
		vodLinks: Sequelize.STRING,
		durations: Sequelize.STRING,
	});

	//Attach the database + tables to the discord client so the discord commands can access the related tables.
	client.dbs = sequelize;
	client.dbs.guildsubs = GUILD_SUBS;
	client.dbs.twitchstreamers = TWITCH_STREAMERS;
	client.dbs.temp = SUB_TEMP;
	client.dbs.streamtemp = STREAM_INFO;

	client.dbs.guildsubs.sync({force: force});
	client.dbs.twitchstreamers.sync({force: force});
	client.dbs.temp.sync({force: true});
	client.dbs.streamtemp.sync({force: true});
	//Create a map and attach it to client. Initialize it in ready.js
	client.hmap = new Map();
	client.mapChangesToBe = new Map();
	client.guildSet = new Set();

	console.log(`Making facial expressions at Twitch . . .`);
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
	if(force) {await apiClient.eventSub.deleteAllSubscriptions();}

	const twitchListener = new EventSubHttpListener({apiClient, adapter: RPAdapter, secret, strictHostCheck: true, legacySecrets: true});
	client.twitchListener = twitchListener;

	//Start the two listeners.
	await dbHelper.loadPreviousSubscriptions(client);
	await twitchListener.start();
	await client.login(discordToken);
}

main();
