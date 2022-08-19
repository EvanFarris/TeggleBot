
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, InteractionType, ButtonStyle} = require('discord.js');

const subHelper = require('../helperFiles/subscribe_helper.js');
const dbHelper = require(`../helperFiles/database_functions`);
const validatorHelper = require(`../helperFiles/validation_functions.js`);
const embeddedTitle = `TeggleBot Subscribe Results`;
module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_unsubscribe')
		.setDescription('Unsubscribe from a channel.')
		.addStringOption(option =>
			option.setName('url')
			.setDescription('The url to the streamer you want to unsubscribe from.')
			.setRequired(true)),
	async execute(interaction) {
		if(interaction.memberPermissions.has(`ADMINISTRATOR`) || interaction.memberPermissions.has('MANAGE_WEBHOOKS')) { 
			if(interaction.type === InteractionType.ApplicationCommand) {
				let msg = interaction.options.getString('url');
				let { website, username } = validatorHelper.checkUrl(msg);

				//Check if we have a valid website/username combo.

				if(website === "") {
					let description = 'Invalid url entered.';
					return interaction.reply({ embeds : [subHelper.createEmbeddedMessage(embeddedTitle, description)]});;
				} else if(username == "") {
					let description = "Username must not be empty.";
					return interaction.reply({ embeds : [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
				} else if(website == "twitch" && !validatorHelper.isValidTwitchUsername(username)){
					let description = "Invalid username entered.";
					return interaction.reply({ embeds : [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
				}
				

				const gs_tableEntry = await subHelper.getGuildSubsTableEntry(interaction);
				if(!gs_tableEntry) {
					let description = `You are not subscribed to ${msg}`;
					return interaction.reply({ embeds : [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
				}

				const actionRow = new ActionRowBuilder()
					.addComponents(
							new ButtonBuilder()
								.setCustomId('tb_unsubscribe_yes')
								.setLabel(`Yes (Unsubscribe)`)
								.setStyle(ButtonStyle.Primary),
							new ButtonBuilder()
								.setCustomId(`tb_unsubscribe_no`)
								.setLabel(`No`)
								.setStyle(ButtonStyle.Secondary),
						);

				let replyEmbedded = await subHelper.createEmbeddedMessageComplicated(username, website, interaction.client.twitchAPI);
				await interaction.reply({ ephemeral: true, embeds: [replyEmbedded], components: [actionRow] })
					.then(() => {
						setTimeout(function() {
						actionRow.components[0].setDisabled(true);
						actionRow.components[1].setDisabled(true);
						interaction.editReply({ephemeral: true, embeds: [replyEmbedded], components: [actionRow]});
						},8000)
					});

				const filter = i => i.customId == "tb_unsubscribe_yes" || i.customId == "tb_unsubscribe_no";
				const collector = interaction.channel.createMessageComponentCollector({ filter, time: 8000 });
				try {
					collector.on(`collect`, async i => {
						actionRow.components[0].setDisabled(true);
						actionRow.components[1].setDisabled(true);
						interaction.editReply({ephemeral: true, embeds: [replyEmbedded], components: [actionRow]});
					});
				} catch (error) {}
				
			} else if(interaction.isButton() && interaction.customId == "tb_unsubscribe_yes") {
				
				//Update TWITCH_STREAMERS table
				let { username, website, streamer, gs_tableEntry } = await getFromEmbedded(interaction);
				
				if( streamer == null ) {
					let description = `Streamer does not exist in the database`;
					return interaction.reply({ embeds: [subHelper.createEmbeddedMessage(embeddedTitle, description)] });
				}

				let succeeded = 0;
				if(website == "twitch") {
					let { updatedRows, channelId } = await updateGuildSubs(interaction, gs_tableEntry, username, website);
					if(updatedRows > 0) {
						succeeded = await updateTwitchStreamer(interaction, streamer, channelId); 
					} else {
						let description = "Channel was deleted by another call?";
						return interaction.reply({ embeds: [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
					}
						
				} else if(website == "youtube") {

				} else { //Something went wrong, end the function.
					return;
				}

				if(succeeded == 1) {
					const usernameFixed = username.charAt(0).toUpperCase() + username.slice(1);
					const description = `You have successfully unsubscribed to ${usernameFixed}`; 
					
					await interaction.reply({ embeds: [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
				}

			} else {
				interaction.reply("OK");
			}


		} else {
			await interation.reply('You must have either the Administrator permission or the Manage Webhooks permission to use this command.');
		}
	},
};



async function getFromEmbedded(interaction) {
	const { website, username } = validatorHelper.checkUrl(interaction.message.embeds[0].url);
	const gs_tableEntry = await subHelper.getGuildSubsTableEntry(interaction);
	let streamer = null;
	
	if( website == "twitch" ) {
		streamer = await validatorHelper.checkTwitchStreamerExistsLocal(interaction, username);
	} else if (website == "youtube") {

	}

	return { username, website, streamer, gs_tableEntry };
}

async function updateTwitchStreamer(interaction, streamer, channelId) {
	let streamerParsed = JSON.parse(streamer.get('followers')).followers;
	let username = streamer.get(`username`);
	let streamerId = streamer.get(`streamerId`);

	for(i = 0; i < streamerParsed.length; i++) {
		if(streamerParsed[i] == channelId) {
			try {
				if(streamerParsed.length > 1) {
					streamerParsed = streamerParsed.slice(0,i).concat(streamerParsed.splice(i+1,streamerParsed.length));
					let streamerStringified = JSON.stringify({"followers" : streamerParsed});
					await interaction.client.dbs.twitchstreamers.update({ "followers": streamerStringified }, {where: {username: `${username}`}});
				} else {
					const deletedRow = await interaction.client.dbs.twitchstreamers.destroy({where: { username: `${username}`}});
					await stopListeners(interaction, streamerId);
				}
				return 1;
			} catch (error) {
				console.log(`~~~~updateTwitchStreamer~~~~\n${error}\n`);
				return -1;
			}
			
		}
	}

	return 0;
}

async function updateGuildSubs(interaction, gs_tableEntry, username, website) {
	let jsonParsed = JSON.parse(gs_tableEntry.get(`streamers`));
	let jsonNames = jsonParsed.names;
	let jsonWebsites = jsonParsed.websites;
	let jsonChannels = jsonParsed.channels;
	let numSubbed = JSON.parse(gs_tableEntry.get(`numStreamers`));
	let channelId = "";
	let updatedRows = "";
	for(i = 0; i < jsonNames.length; i++) {
		if (jsonNames[i] == username && jsonWebsites[i] == website) {
			try {			
				numSubbed--;
				if(numSubbed != 0 ) {
					channelId = jsonChannels[i];
					jsonNames = jsonNames.slice(0,i).concat(jsonNames.splice(i + 1,jsonNames.length));
					jsonWebsites = jsonWebsites.slice(0,i).concat(jsonWebsites.slice(i + 1,jsonWebsites.length));
					jsonChannels = jsonChannels.slice(0,i).concat(jsonChannels.slice(i + 1,jsonChannels.length));
					jsonParsed  = JSON.stringify({"names" : jsonNames, "websites" : jsonWebsites, "channels" : jsonChannels });

					updatedRows = await interaction.client.dbs.guildsubs.update({streamers: jsonParsed, numStreamers : numSubbed}, {where: {guildID: `${interaction.guildId}`}});
						
				} else {
					//Delete entry from table
					channelId = jsonChannels[0];
					updatedRows = await interaction.client.dbs.guildsubs.destroy({where: { guildID: `${interaction.guildId}`}});
				}

				break;
			} catch (error) {
				console.log(`~~~~updateGuildSubs~~~~\n${error}\n`);
				break;
			}

		}
	}
	return {updatedRows, channelId};
}


async function stopListeners(interaction, streamerId) {
	const {onlineSubscription, offlineSubscription} = interaction.client.hmap.get(streamerId);
	try{
		await onlineSubscription.stop();
		await offlineSubscription.stop();
		interaction.client.hmap.delete(streamerId);
	} catch (error) {
		console.log(`~~~~stopListeners~~~~\n${error}\n`)
	}
}