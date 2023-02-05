const {InteractionType} = require('discord.js');
module.exports = {
	name: 'interactionCreate',
	execute(interaction) {
		if((!interaction.isCommand() && !interaction.isButton() && !interaction.isStringSelectMenu())) {return;}
		
		if(interaction.isCommand()) {
			const command = interaction.client.commands.get(interaction.commandName);
			if(!command) return;
			try {
				if(interaction.type === InteractionType.ApplicationCommand) {
					//Let safe commands and dev commands be executed regardless of state or permissions.
					if(interaction.client.safeCommands.has(interaction.commandName)) {
						command.execute(interaction);
					} else if(!interaction.client.guildSet.has(interaction.guildId)) { 
						//Only allow people that have special permissions to use commands that change database state.
						if(!interaction.memberPermissions.any([`Administrator`, `ManageWebhooks`, `ManageGuild`])) {
							return interaction.reply({content: 'You must have at least the Administrator, Manage Webhooks, or Manage Server permission to use this command.', ephemeral: true});
						}
						//Adding guildIds to the set stops race condition when calling a command twice. 
						interaction.client.guildSet.add(interaction.guildId);
						command.execute(interaction);
					} else {
						interaction.reply(`Guild already has an active slash command going on. Please wait until that command is resolved.`);
					}
					
				} 
			} catch (error) {
				console.error(error);
				interaction.reply({ content: `There was an error while executing this command!`, ephemeral: true});
			}
		} else {
			if(interaction.client.commands.has(interaction.customId)) {
				interaction.client.commands.get(interaction.customId).execute(interaction);
			} else if(interaction.customId == `button_no`) {
				interaction.update({ephemeral: true});
			}
		}
	}
};