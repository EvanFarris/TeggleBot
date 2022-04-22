require('dotenv').config()

const fs = require('node:fs');
const { Client, Collection, Intents } = require('discord.js');
const { DISCORD_TOKEN: discordToken, TWITCH_CLIENT_ID: twitchClientId, TWITCH_CLIENT_SECRET: twitchClientSecret, TWITCH_ACCESS_TOKEN: listenerString } = process.env;

const Sequelize = require('sequelize');

const { ApiClient } = require('twitch');
const { ClientCredentialsAuthProvider } = require('twitch-auth');
const { DirectConnectionAdapter, EventSubListener } = require('twitch-eventsub');

const client = new Client({ intents: [Intents.FLAGS.GUILDS]});
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
	guildID: {
		type: Sequelize.STRING,
		unique: true,
	},
	streamers: Sequelize.TEXT,
	numStreamers: {
		type: Sequelize.INTEGER,
		defaultValue: 1,
		allowNull: false,
	},
});



const TWITCH_STREAMERS = sequelize.define('twitch_streamers', {
	username: {
		type: Sequelize.STRING,
		unique: true,
	},
	streamerId: Sequelize.STRING,
	lastOnline: Sequelize.STRING, //For timed unsubscription purposes
	followers: Sequelize.TEXT,	//JSON guild channelids to send out livestream notifications.
});

/*
const STREAMERS_INFO = sequelize.define('streamers_info', {
	streamers_info: {
		type: Sequelize.STRING,
		unique: true,
	},
	streamers: Sequelize.TEXT,
});
*/
//Attach the database to the discord client so the discord commands can access the related tables.
client.dbs = sequelize;
client.dbs.guildsubs = GUILD_SUBS;
client.dbs.twitchstreamers = TWITCH_STREAMERS;

//Setup the twitch client with auto-refreshing token.
const authProvider = new ClientCredentialsAuthProvider(twitchClientId, twitchClientSecret);

const apiClient = new ApiClient({ authProvider });
client.twitchAPI = apiClient;

const twitchListener = new EventSubListener(apiClient, new DirectConnectionAdapter({
	hostName: `localhost`,
	sslCert: {
		key: fs.readFileSync("./localhost.decrypted.key", `utf-8`),
		cert: fs.readFileSync("./localhost.crt",`utf-8`)
	}
}), `${listenerString}`);

client.twitchListener = twitchListener;

twitchListener.listen();
client.login(discordToken);
