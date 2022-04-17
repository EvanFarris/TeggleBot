require('dotenv').config()

const fs = require('node:fs');
const { Client, Collection, Intents } = require('discord.js');
const { DISCORD_TOKEN: discordToken, TWITCH_TOKEN: twitchToken } = process.env;

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

client.login(discordToken);

//console.log(`Discord token: ${discordToken}`);
//console.log(`Twitch token: ${twitchToken}`);
