const { SlashCommandBuilder } = require('discord.js');
const dbHelper = require(`../../helperFiles/database_functions.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_dev_add_exempt_guild')
		.setDescription('Add a guild that is exempt from limits')
		.addStringOption(option =>
			option.setName(`guild_id`)
			.setDescription('ID of guild you want to add.')
			.setRequired(true)),
	async execute(interaction) {
		const guildID = interaction.options.getString(`guild_id`);
		if(interaction.client.exemptGuilds.has(guildID)){
			interaction.reply(`Guild is already exempt.`);
		} else {
			const succ = await dbHelper.addExemptGuild(interaction.client, guildID);
			if(succ){
				interaction.client.exemptGuilds.add(guildID);
				interaction.reply(`Guild added to exempt list.`);
			} else {interaction.reply(`Guild not added to exempt list`);}
		}

	},
	
};