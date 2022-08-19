const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, InteractionType, ButtonStyle} = require('discord.js');

const wait = require(`node:timers/promises`).setTimeout;

const embeddedTitle = `TeggleBot Subscribe Results`;
const subHelper = require('../helperFiles/subscribe_helper.js');
const dbHelper = require(`../helperFiles/database_functions`);
const validatorHelper = require(`../helperFiles/validation_functions.js`);

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
				
				//Check to see if the guild is subscribed to anyone. 
				//If they are, make sure the streamer to be added isn't already subscribed to in the local database already.
				//Also, the guild must have room to subscribe to continue.
				if(gs_tableEntry && ((await dbHelper.checkIfStreamerIsInGuildSubsAlready(interaction, gs_tableEntry, username, website)) || !(await dbHelper.checkIfGuildCanSubscribeToAnotherStreamer(interaction, gs_tableEntry)))) { return; }
				const { streamer, streamerId } = await validatorHelper.validateUserExists(interaction, username, website);
				
				if(streamerId == null) {return;}
				
				const { actionRow, replyEmbedded } = await getEmbeddedComponents(interaction, username, website);
				
				await sendStreamerToReplyTo(interaction, actionRow, replyEmbedded);

			} else if (interaction.isButton() && interaction.customId == "tb_subscribe_yes") {
				//Update TWITCH_STREAMERS table
				let { username, website, streamerId, streamer, gs_tableEntry } = await getFromEmbedded(interaction);
				
				if(website == "twitch" && streamer != null) {
						await dbHelper.updateTwitchStreamer(interaction, streamer);
				} else if(website == "twitch" && streamerId != "" && streamerId != "!error") {
						await dbHelper.createTwitchStreamer(interaction, username, streamerId);
				} else if(website == "youtube") {

				} else { //Something went wrong, end the function.
					return;
				}

				//Update GUILD_SUBS table
				let succeeded;
				if(gs_tableEntry != null) {
					succeeded = await dbHelper.updateGuildSubs(interaction, gs_tableEntry, username, website);					
				} else {
					succeeded = await dbHelper.createGuildSubs(interaction, username, website);
				} 

				if(succeeded == 1) {
					const usernameFixed = username.charAt(0).toUpperCase() + username.slice(1);
					const description = `You have successfully subscribed to ${usernameFixed}`; 
					
					await interaction.reply({ embeds: [subHelper.createEmbeddedMessage(embeddedTitle, description)]});
				}

			} else if (interaction.isButton() && interaction.customId == "tb_subscribe_no") {
				interaction.update({components: []});
			}

		} else {
			await interaction.reply('You must have either the Administrator permission or the Manage Webhooks permission to use this command.');
		}
		
	},
	
};

async function getFromEmbedded(interaction) {
	let { website, username } = validatorHelper.checkUrl(interaction.message.embeds[0].url);
	let gs_tableEntry = await subHelper.getGuildSubsTableEntry(interaction);
	const { streamer, streamerId } = await validatorHelper.validateUserExists(interaction, username, website);

	return { username, website, streamerId, streamer, gs_tableEntry };
}

async function getEmbeddedComponents(interaction, username, website) {
	const actionRow = new ActionRowBuilder()
		.addComponents(
				new ButtonBuilder()
					.setCustomId('tb_subscribe_yes')
					.setLabel(`Yes (Subscribe)`)
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(`tb_subscribe_no`)
					.setLabel(`No`)
					.setStyle(ButtonStyle.Secondary),
		);
	let replyEmbedded = await subHelper.createEmbeddedMessageComplicated(username, website, interaction.client.twitchAPI);
	return { actionRow, replyEmbedded };
}

async function sendStreamerToReplyTo(interaction, actionRow, replyEmbedded) {
	try {
			await interaction.reply({ ephemeral: true, embeds: [replyEmbedded], components: [actionRow] })
				then(() => {
					setTimeout(function() {
					actionRow.components[0].setDisabled(true);
					actionRow.components[1].setDisabled(true);

					interaction.editReply({ephemeral: true, embeds: [replyEmbedded], components: [actionRow]});
					},8000)
				});
		} catch (error) {}
			
		const filter = i => i.customId == "tb_subscribe_yes" || i.customId == "tb_subscribe_no";
		const collector = interaction.channel.createMessageComponentCollector({ filter, time: 8000 });
				
		try {
			collector.on(`collect`, async i => {
				actionRow.components[0].setDisabled(true);
				actionRow.components[1].setDisabled(true);
				interaction.editReply({ephemeral: true, embeds: [replyEmbedded], components: [actionRow]});
			});
		} catch (error) {}
}