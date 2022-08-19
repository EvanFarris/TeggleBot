const {InteractionType} = require('discord.js');
module.exports = {
	name: 'interactionCreate',
	execute(interaction) {
		if(!interaction.isCommand() && !interaction.isButton()) return;
		if(interaction.isCommand()) {
			const command = interaction.client.commands.get(interaction.commandName);
			if(!command) return;
			try {
				if(interaction.type === InteractionType.ApplicationCommand) {
					command.execute(interaction);
				} 
			
			} catch (error) {
				console.error(error);
				interaction.reply({ content: `There was an error while executing this command!`, ephemeral: true});
			}
		} else {
			if(interaction.customId == "tb_subscribe_yes" || interaction.customId == "tb_subscribe_no") {
				interaction.client.commands.get("tb_subscribe").execute(interaction);
			} else if (interaction.customId == "tb_unsubscribe_yes" || interaction.customId == "tb_unsubscribe_no") {
				interaction.client.commands.get("tb_unsubscribe").execute(interaction);
			}
		}
		

		
		
	}
};