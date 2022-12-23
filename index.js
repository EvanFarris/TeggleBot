require('dotenv').config();

const fs = require('node:fs');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { DISCORD_TOKEN: discordToken, TWITCH_CLIENT_ID: twitchClientId, TWITCH_CLIENT_SECRET: twitchClientSecret, TWITCH_ACCESS_TOKEN: listenerString } = process.env;

const Sequelize = require('sequelize');

const { ApiClient } = require('@twurple/api');
const { ClientCredentialsAuthProvider } = require('@twurple/auth');
const { DirectConnectionAdapter, EventSubListener, ReverseProxyAdapter } = require('@twurple/eventsub');

const { NgrokAdapter } = require('@twurple/eventsub-ngrok');

const client = new Client({ intents: [GatewayIntentBits.Guilds]});
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

//Load commands into the client
for(const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.data.name, command);
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

//Define the sqlite file
const sequelize = new Sequelize('database','user', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: 'database.sqlite',
});

//create the GUILD_SUBS table with primary key: guildID, streamers, and numStears.
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
	lastOnline: Sequelize.STRING, //For timed unsubscription purposes
	followers: Sequelize.TEXT,	//JSON guild channelids to send out livestream notifications.
});

//Attach the database to the discord client so the discord commands can access the related tables.
client.dbs = sequelize;
client.dbs.guildsubs = GUILD_SUBS;
client.dbs.twitchstreamers = TWITCH_STREAMERS;

//Create map and attach it to client. Initialize it in ready.js
client.hmap = new Map();
//Setup the twitch client with auto-refreshing token.
const authProvider = new ClientCredentialsAuthProvider(twitchClientId, twitchClientSecret);

const apiClient = new ApiClient({ authProvider, logger: {minLevel:'debug'} });
client.twitchAPI = apiClient;


const RPAdapter = new ReverseProxyAdapter({
	hostName: `teggle.dev`,
	pathPrefix: `/tegglebot`,
	usePathPrefixInHandlers: true,
	port: 3000
});

let secret = listenerString;
//required for ngrok
apiClient.eventSub.deleteAllSubscriptions();

//const twitchListener = new EventSubListener({apiClient, adapter: new NgrokAdapter(), secret, strictHostCheck: true});
const twitchListener = new EventSubListener({apiClient, adapter: RPAdapter, secret, strictHostCheck: true});
client.twitchlistener = twitchListener;

twitchListener.listen();
client.login(discordToken);