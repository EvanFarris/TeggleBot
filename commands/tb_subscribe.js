const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_subscribe')
		.setDescription('Subscribe to a streamer.')
		.addStringOption(option =>
			option.setName('url')
			.setDescription('The url to the streamer you want to subscribe to.')
			.setRequired(true)),
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
				return interaction.reply(`Error occured while trying to subscribe.\n${error}`)
			}
			
			if(gs_tableEntry) { //If there is an entry in GUILD_SUBS, retrieve it, check if they have < 5 subscribed users, 
				
				let numSubbed = gs_tableEntry.get(`numStreamers`);
				if(numSubbed <= 4) {
					let jsonParsed = JSON.parse(gs_tableEntry.get(`streamers`));
					let jsonNames = jsonParsed.names;
					let jsonWebsites = jsonParsed.websites;
					
					for(i = 0; i < jsonNames.length; i++) {
						if (jsonNames[i] == username && jsonWebsites[i] == website) {
							return interaction.reply(`${username} has already been subscribed to.`);
						}
					}

					try {
						jsonNames.push(username);
						jsonWebsites.push(website);
						numSubbed += 1;
						jsonParsed  = JSON.stringify({"names" : jsonNames, "websites" : jsonWebsites });

						const updatedRows = await interaction.client.dbs.guildsubs.update({streamers: jsonParsed, numStreamers : numSubbed}, {where: {guildID: `${interaction.guildid}`}});
						if(updatedRows > 0) {
							return interaction.reply(`You have successfully subscribed to: ${username} on ${website}`);
						} else {
							return interaction.reply('Something went wrong inserting an entry into an existing subscription list.');
						}

					} catch (error) {
						await interaction,reply(`Something went wrong updating the database entry.`);
					}

					
				} else {
					await interaction.reply('You can only have up to 5 streamers subscribed at a time.');
				}
				
			} else {
				try {
					let jsonTEST = JSON.stringify({ "names" : [username], "websites" : [website] });
					const dbEntryInserted = await interaction.client.dbs.guildsubs.create({
						guildID: `${interaction.guildid}`,
						streamers: `${jsonTEST}`,
						numStreamers: 1,
					});
					await interaction.reply(`You have successfully subscribed to: ${username} on ${website}`);
				} catch(error) {
					await interaction.reply('Something went wrong while creating the entry for the first subscription in the database.');
				}
			}

			
		} else {
			await interation.reply('You must have either the Administrator permission or the Manage Webhooks permission to use this command.');
		}
		
	},
	
};