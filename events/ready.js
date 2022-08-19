module.exports = {
	name: 'ready',
	once: true,
	execute(client) {
		console.log("Syncing database tables...");
		client.dbs.guildsubs.sync({force:true});
		client.dbs.twitchstreamers.sync({force:true});
		console.log("Syncing complete.");
		console.log("Loading listeners...");
		//startListeners(client);
		console.log("Loading complete.");

		console.log(`Ready! Logged in as ${client.user.tag}`);
	},
};

async function startListeners(client) {
	let rows = await client.dbs.twitchstreamers.findAll();
	let sName, sId, obj;
	let curDate = new Date();
	let curTime = curDate.getTime();
	//If the 
	const cutoffTime = curTime - (1000 * 60 * 60 * 24 * 14);
	

	for(i = 0; i < rows.length; i++) {
		obj = rows.at(i);
		sName = obj.get("username");
		sId = obj.get("streamerId");
		if(obj.get("lastOnline") > cutoffTime) {

		} else { //delete

		}

		
	}
}