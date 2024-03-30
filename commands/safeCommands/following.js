const { SlashCommandBuilder } = require('discord.js');
const embedHelper = require(`../../helperFiles/embed_functions.js`);
/*
	This module returns an embedded message of all the streamers that a guild is subscribed to, and which websites they stream on.
*/
module.exports = {
	data: new SlashCommandBuilder()
		.setName('following')
		.setDescription('Check which streamers your guild is following.')
		.addStringOption(option => 
			option.setName(`type`)
				.setDescription(`Show streamers or mangas the guild is following.`)
				.setRequired(true)
				.addChoices(
					{name: `Manga`, value: `manga`},
					{name: `Streamer`, value: `streamer`},
					)),
	async execute(interaction) { 
		try {
			const guildName = interaction.guild.name;
			const guildIcon = interaction.guild.iconURL();
			let embedToSend = null;
			if(interaction.options.getString(`type`) == `streamer`){
				let dbresult = await interaction.client.dbs.guildsubs.findOne({where: { guildId: `${interaction.guildId}` }});
				let numStreamers = 0, streamersInfo = null, twitchStreamerNames = null, twitchCustomMessages = null, twitchCustomImages = null, twitchChannelIds = null;

				if(dbresult) {
					numStreamers = dbresult.numStreamers;
					streamersInfo = JSON.parse(dbresult.streamersInfo);
					twitchStreamerNames = streamersInfo.streamerDisplayNames;
					twitchCustomMessages = streamersInfo.customMessages;
					twitchCustomImages = streamersInfo.customImages;
					twitchChannelIds = streamersInfo.channelIds;
				}
				embedToSend = embedHelper.createFollowingEmbed(twitchStreamerNames, twitchCustomMessages, twitchCustomImages, twitchChannelIds, guildName, guildIcon, numStreamers);
			} else if(interaction.options.getString(`type`) == `manga`) {
				const mgs_te = await interaction.client.dbs.mangaguildsubs.findOne({where: {guildId: interaction.guildId}});
				embedToSend = embedHelper.createFollowingMangaEmbed(mgs_te, guildName, guildIcon);
			}
			interaction.client.guildSet.delete(interaction.guildId);
			interaction.reply({embeds: [embedToSend]});
		} catch (error) {
			return interaction.reply(`Error checking subscriptions.\n${error}`);
		}

	},
};

