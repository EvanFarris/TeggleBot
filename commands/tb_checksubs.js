const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tb_checksubs')
		.setDescription('Check what streamers you are subscribed to.'),
	async execute(interaction) { 
		try {
			let dbresult = await interaction.client.dbs.guildsubs.findOne({where: { guildID: `${interaction.guildid}` }});
			if(dbresult) {
				let str = `You are subscribed to ${dbresult.get('numStreamers')} streamers.\n`;
				let jsonObj = JSON.parse(dbresult.get('streamers'));
				for(i = 0; i < jsonObj.websites.length; i++) {
					str += `${jsonObj.websites[i]} ${jsonObj.names[i]}\n`;
				}
				await interaction.reply(str);
			} else {
				return interaction.reply(`You are not subscribed to anyone.`);
			}

		} catch (error) {
			return interaction.reply(`Error checking subscriptions.\n${error}`);
		}

	},
};