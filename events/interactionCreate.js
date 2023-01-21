const {InteractionType} = require('discord.js');
module.exports = {
	name: 'interactionCreate',
	execute(interaction) {
		if(!interaction.isCommand() && !interaction.isButton() && !interaction.isStringSelectMenu()) return;
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
			if(interaction.customId == "follow_yes" || interaction.customId == "follow_no") {
				interaction.client.commands.get("follow").execute(interaction);
			} else if (interaction.customId == "unfollow_select_menu") {
				interaction.client.commands.get("unfollow").execute(interaction);
			} else if (interaction.customId == "change_message") {
				interaction.client.commands.get("change_message").execute(interaction);
			}
		}
		

		
		
	}
};