const { SlashCommandBuilder } = require('@discordjs/builders');

function getString() {
	return 'Pong!';
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with Pong!'),
	async execute(interaction) {
		await interaction.reply(getString());
	},
	
};