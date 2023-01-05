const dbHelper = require(`../helperFiles/database_functions`);

module.exports = {
	name: 'ready',
	once: true,
	execute(client) {
		console.log("Calming down Discord . . .");
		startListeners(client);
		console.log(`Ready! Logged in as ${client.user.tag}`);
	},
};

async function startListeners(client) {
	let rows = await client.dbs.twitchstreamers.findAll();
	let sName, sId, obj;
	let curDate = new Date();
	let curTime = curDate.getTime();
	//If the 
	const cutoffTime = curTime - (1000 * 60 * 60 * 24 * 30);
	
	for(i = 0; i < rows.length; i++) {
		obj = rows.at(i);
		sName = obj.get("streamerUsername");
		sId = obj.get("streamerId");
		if(obj.get("lastOnline") > cutoffTime) {
			await dbHelper.twitchEventSubSubscribe(client, sId);
		} else { //delete

		}

		
	}
}