require('dotenv').config()

const fs = require('node:fs');
const { REST, Routes } = require(`discord.js`);

const { DISCORD_BOT_TOKEN: discordToken, DISCORD_CLIENT_ID: clientID, DISCORD_TEST_SERVER_ID: guildID, DISCORD_TEST_SERVER_ID2: guildID2 } = process.env;

const commands = [];
const commandFiles = fs.readdirSync('./commands/unsafeCommands').filter(file => file.endsWith('.js'));
const devCommands = [];
const devFiles = fs.readdirSync('./commands/devCommands').filter(file => file.endsWith('.js'));
const safeFiles = fs.readdirSync(`./commands/safeCommands`).filter(file => file.endsWith(`.js`));

for(const file of commandFiles) {
	const command = require(`./commands/unsafeCommands/${file}`);
	commands.push(command.data.toJSON());
}

for(const file of safeFiles) {
	const command = require(`./commands/safeCommands/${file}`);
	commands.push(command.data.toJSON());
}

for(const file of devFiles) {
	const command = require(`./commands/devCommands/${file}`);
	devCommands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(discordToken);

(async () => {
	try {
		console.log('Refreshing application (/) commands...');
		//Global commands
		await rest.put(Routes.applicationCommands(clientID), {body: commands});
		//Sends only devCommands to these test guilds, comment out if you don't have test guilds

		if(guildID){await rest.put(Routes.applicationGuildCommands(clientID,guildID), {body: devCommands});}
		if(guildID2){await rest.put(Routes.applicationGuildCommands(clientID,guildID2), {body: devCommands});}
		console.log('Refresh completed.');

	} catch (error) {
		console.error(error);
	}
})();
