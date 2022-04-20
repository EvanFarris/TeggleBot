const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_unsubscribe')
		.setDescription('Unsubscribe from a channel.')
		.addStringOption(option =>
			option.setName('url')
			.setDescription('The url to the streamer you want to unsubscribe from.')
			.setRequired(true)),
	async execute(interaction) {
		await interaction.reply('Pong!');
	},
	async execute(interaction) {
		if(interaction.memberPermissions.has(`ADMINISTRATOR`) || interaction.memberPermissions.has('MANAGE_WEBHOOKS')) { 
			let twitchRegex = /.*twitch.tv\//;
			let youtubeRegex = /.*youtube.com\/[user\/]*/;
			let msg = interaction.options.getString('url');
			let username = "";
			let website = "";

			if(twitchRegex.test(msg)) {
				username = msg.replace(twitchRegex,"");
				website = "twitch";
			} else if (youtubeRegex.test(msg)) {
				username = msg.replace(youtubeRegex,"");
				website = "youtube";
			} else {
				await interaction.reply('Invalid url entered.');
				return;
			}

			let gs_tableEntry = null;
			try {
				if(username != "") {
					 gs_tableEntry = await interaction.client.dbs.guildsubs.findOne({ where: { guildID: `${interaction.guildid}` }});
				} else {
					return interaction.reply("Username must not be empty.");
				}
				
			} catch(error) {
				return interaction.reply(`Error occured while trying to un-subscribe.\n${error}`)
			}

			if(gs_tableEntry) { //If there is an entry in GUILD_SUBS, retrieve it, check if they have < 5 subscribed users, 
				
				let numSubbed = gs_tableEntry.get(`numStreamers`);
				
					let jsonParsed = JSON.parse(gs_tableEntry.get(`streamers`));
					let jsonNames = jsonParsed.names;
					let jsonWebsites = jsonParsed.websites;
					
					for(i = 0; i < jsonNames.length; i++) {
						if (jsonNames[i] == username && jsonWebsites[i] == website) {
							try {
								//TODO: Fix these two lines.
								jsonNames = jsonNames.slice(0,i).concat(jsonNames.splice(i+1,jsonNames.length));
								jsonWebsites = jsonWebsites.slice(0,i).concat(jsonWebsites.slice(i+1,jsonWebsites.length));
								console.log(jsonNames);
								console.log(jsonWebsites);
								numSubbed--;
								if({numSubbed} !== 0 ) {
									jsonParsed  = JSON.stringify({"names" : jsonNames, "websites" : jsonWebsites });

									const updatedRows = await interaction.client.dbs.guildsubs.update({streamers: jsonParsed, numStreamers : numSubbed}, {where: {guildID: `${interaction.guildid}`}});
									if(updatedRows) {
										return interaction.reply(`You have successfully been un-subscribed from: ${username} on ${website}`);
									} else {
										return interaction.reply('Something went wrong removing an entry into an existing subscription list.');
									}
								
								} else {
									//Delete entry from table
									const deletedRow = await interaction.client.dbs.guildsubs.destroy({where: { guildID: `${interaction.guildid}`}});
									return interaction.reply("You are no longer subscribed to anyone.");
								}
								

							} catch (error) {
								await interaction.reply(`Something went wrong updating the database entry.`);
							}

						}
					}

					//Username & website combo not found
					return interaction.reply(`The server is not subscribed to ${username} on ${website}`);
					
				
				
			} else {
				await interaction.reply('This server is not subscribed to anyone.');
			}



		} else {
			await interation.reply('You must have either the Administrator permission or the Manage Webhooks permission to use this command.');
		}
	},
};