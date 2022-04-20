require('dotenv').config()

const fs = require('node:fs');
const { Client, Collection, Intents } = require('discord.js');
const { DISCORD_TOKEN: discordToken, TWITCH_TOKEN: twitchToken } = process.env;
const Sequelize = require('sequelize');

const client = new Client({ intents: [Intents.FLAGS.GUILDS]});
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for(const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.data.name, command);
}

const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));

for(const file of eventFiles) {
	const event = require(`./events/${file}`);
	if(event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

const sequelize = new Sequelize('database','user', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: 'database.sqlite',
});

const GUILD_SUBS = sequelize.define('guild_subs', {
	guildID: {
		type: Sequelize.STRING,
		unique: true,
	},
	streamers: Sequelize.TEXT,
	numStreamers: {
		type: Sequelize.INTEGER,
		defaultValue: 0,
		allowNull: false,
	},
});

client.dbs = sequelize;
client.dbs.guildsubs = GUILD_SUBS;
/*
const STREAMERS_TO_CHANNELS = sequelize.define('streamers_to_channels', {
	guildID: {
		type: Sequelize.STRING,
		unique: true,
	},
	channels: Sequelize.TEXT,
});

const STREAMERS_INFO = sequelize.define('streamers_info', {
	streamers_info: {
		type: Sequelize.STRING,
		unique: true,
	},
	streamers: Sequelize.TEXT,
});
*/

client.login(discordToken);
