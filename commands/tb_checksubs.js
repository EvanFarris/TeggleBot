const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
/*
	This module returns an embedded message of all the streamers that a guild is subscribed to, and which websites they stream on.
*/
module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_checksubs')
		.setDescription('Check what streamers your guild is subscribed to.'),
	async execute(interaction) { 
		try {
			let guildName = interaction.guild.name;
			let numStreamers = `0`;
			let guildIcon = interaction.guild.iconURL();
			let twitchSubs = "";
			let youtubeSubs = "";

			let dbresult = await interaction.client.dbs.guildsubs.findOne({where: { guildId: `${interaction.guildId}` }});
			if(dbresult) {
				numStreamers = `${dbresult.get('numStreamers')}`;

				let jsonObj = JSON.parse(dbresult.get('streamersInfo'));
				let name;
				for(i = 0; i < jsonObj.websites.length; i++) {
					name = `${jsonObj.names[i]}\n`;
					name = name.charAt(0).toUpperCase() + name.slice(1);
					
					if(jsonObj.websites[i] == "twitch") {
						twitchSubs += name;
					} else if (jsonObj.websites[i] == "youtube") {
						youtubeSubs += name;
					}
				}	
			}

			await interaction.reply({embeds: [createEmbed(guildName, numStreamers, guildIcon, twitchSubs, youtubeSubs)]});
		} catch (error) {
			return interaction.reply(`Error checking subscriptions.\n${error}`);
		}

	},
};

function createEmbed(guildName, numStreamers, guildIcon, twitchSubs, youtubeSubs) {
	const embeddedMessage = new EmbedBuilder()
		.setColor(`#0099ff`)
		.setTitle(`Streamers that ${guildName} is subscribed to (/tb_checksubs)`)
		.setDescription(`You are subscribed to ${numStreamers} streamers.`);
		
		if(guildIcon != null) {
			embeddedMessage.setThumbnail(`${guildIcon}`);
		}
		
		if(numStreamers == '0') {
			embeddedMessage.setDescription(`You are not subscribed to anyone.`);
		}

		if(twitchSubs.length > 0) {
			embeddedMessage.addFields({name: `Twitch.tv`, value: twitchSubs});
		}

		if(youtubeSubs.length > 0) {
			embeddedMessage.addFields({name: `Youtube`, value: youtubeSubs});
		}

		return embeddedMessage;
}