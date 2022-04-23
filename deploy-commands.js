require('dotenv').config()

const fs = require('node:fs');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9'); 
const { DISCORD_TOKEN: discordToken, DISCORD_CLIENT_ID: clientID, DISCORD_TEST_SERVER_ID: guildID, DISCORD_TEST_SERVER_ID2: guildID2 } = process.env;

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for(const file of commandFiles) {
	const command = require(`./commands/${file}`);
	commands.push(command.data.toJSON());
}

const rest = new REST({ version: '9' }).setToken(discordToken);

(async () => {
	try {
		console.log('Refreshing application (/) commands...');
		await rest.put(Routes.applicationGuildCommands(clientID,guildID), {body: commands},);
		await rest.put(Routes.applicationGuildCommands(clientID,guildID2), {body: commands},);
		console.log('Refresh completed.');

	} catch (error) {
		console.error(error);
	}
})();
