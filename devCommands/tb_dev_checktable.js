const { SlashCommandBuilder } = require('discord.js');
/*
	This module allows me to query the two database tables - TWITCH_STREAMERS and GUILD_SUBS in the discord channel.
	This should not be available to any public discord, and it arguably can be replaced by a database reader.
*/
module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_dev_checktable')
		.setDescription('Check a table in the database')
		.addStringOption(option =>
			option.setName('tablename')
			.setDescription('Name of the table you want to check.')
			.setRequired(true)),
	async execute(interaction) {
		let table_name = interaction.options.getString(`tablename`).toUpperCase();
		try {
			let rows;
			let result = ``;
			if(table_name == "TWITCH_STREAMERS") {
				rows = await interaction.client.dbs.twitchstreamers.findAll();
			} else if(table_name == "GUILD_SUBS") {
				rows = await interaction.client.dbs.guildsubs.findAll();
			} else if(table_name == "TEMP"){
				rows = await interaction.client.dbs.temp.findAll();
			} else {
				return interaction.reply("Invalid table name entered.");
			}

			if(rows.length > 0){
				let obj;
				let numFollowers;
				if(table_name == "TWITCH_STREAMERS") {
					for(i = 0; i < rows.length; i++) {
						obj = rows.at(i);
						numFollowers = JSON.parse(obj.get("followersInfo")).followers;
						result += `Username: ${obj.get("streamerUsername")}\nStreamer id: ${obj.get("streamerId")}\nLast online: ${obj.get("lastOnline")}\nNumber of Followers: ${numFollowers.length}\n\n`;
					}
				} else if(table_name == "GUILD_SUBS") {
					for(i = 0; i < rows.length; i++) {
						obj = rows.at(i);
						result += `Guild Id: ${obj.get("guildId")}\nNumber of streamers followed: ${obj.get("numStreamers")}\n`;
					}
				} else if(table_name == "TEMP") {
					result = `${rows.length} entries in TEMP table.`;
				}
				if(result != ""){
					return interaction.reply(`${result}`);
				} else {
					return interaction.reply(`Something went wrong`);
				}
				
			} else {
				await interaction.reply(`No rows in the table.`);
			}
			
		} catch (error) {
			console.log(`checkTwitchStreamers error\n${error}`);
		}
		
	},
	
};