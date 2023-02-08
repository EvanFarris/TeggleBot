const { SlashCommandBuilder } = require('discord.js');
const validationHelper = require(`../helperFiles/validation_functions.js`);
module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_dev_get_vod')
		.setDescription('Get the latest vod for testing purposes')
		.addStringOption(option =>
			option.setName('broadcaster_username')
			.setDescription('Username of the broadcaster you want to get')
			.setRequired(true)),
	async execute(interaction) {
		let streamerUsername = interaction.options.getString(`broadcaster_username`);
		let vodFilter = {period: `day`, type: `archive`, first: 1};
		let streamerObj = await validationHelper.checkTwitchStreamerExistsLocal(interaction.client, streamerUsername);
		let vod = null;

		if(streamerObj) {
			vods = await interaction.client.twitchAPI.videos.getVideosByUser(streamerObj.streamerId, vodFilter);
		}
		if(vods) {
			let lv = (vods.data)[0];
			console.log(`creationDate: ${lv.creationDate} | publishDate: ${lv.publishDate} | duration: ${lv.duration} | durationInSeconds ${lv.durationInSeconds} | streamId ${lv.streamId} | type ${lv.type}`);
		} else {console.log(`User has no vods`);}
		
		interaction.reply(`Check console :)`);
	},
};