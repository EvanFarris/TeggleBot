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
					//Let dev commands be executed 
					if(interaction.client.safeCommands.has(interaction.commandName)) {
						command.execute(interaction);
					} else if(!interaction.client.guildSet.has(interaction.guildId)) {
						if(!interaction.memberPermissions.has(`Administrator`) && !interaction.memberPermissions.has(`ManageWebhooks`) && !interaction.memberPermissions.has(`ManageGuild`)) {
							interaction.reply({content: 'You must have at least the Administrator, Manage Webhooks, or Manage Server permission to use this command.', ephemeral: true});
							return;
						}
						interaction.client.guildSet.add(interaction.guildId);
						command.execute(interaction);
					} else {
						interaction.reply(`Guild already has an active slash command going on. Please wait until that command is resolved.`)
					}
					
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
			} else if(interaction.customId == "change_image") {
				interaction.client.commands.get("change_image").execute(interaction);
			} else if(interaction.customId == "change_channel") {
				interaction.client.commands.get("change_channel").execute(interaction);
			}
		}
		

		
		
	}
};