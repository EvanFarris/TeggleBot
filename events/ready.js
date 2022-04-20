module.exports = {
	name: 'ready',
	once: true,
	execute(client) {
		console.log("Syncing sqlite database: GUILD_SUBS");
		client.dbs.guildsubs.sync({ force: true});
		console.log("Syncing complete.");

		console.log(`Ready! Logged in as ${client.user.tag}`);
	},
};