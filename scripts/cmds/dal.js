module.exports = {
config: {
	name: "dal",
	author: "Tawsif~ & Mahi APIs",
	category: "image",
	countDown: 5,
	role: 0,
	guide: "xl <prompt> --ar <ratio>"
},
onStart: async function({ message, event, args }) {
let ratio = "1:1";
const prompt = args.join(" ");
if (!prompt) { return api.sendMessage("❌ | provide a prompt", event.threadID);
} else if (prompt.match(/--ar=/)) { ratio = prompt.split("--ar=")[1];
}
	message.reaction("⏳", event.messageID);
try {
const t = new Date().getTime();
		let url = `https://mahi-apis.onrender.com/api/daul?prompt=${encodeURIComponent(prompt)}&ratio=${ratio}`;

await message.reply({
attachment: await global.utils.getStreamFromURL(url, 'dal.png'),
body: `✅ | Here's your image ✨\n🕔 | Time taken: ${(new Date().getTime() -t)/1e3} seconds`});
	message.reaction("✅", event.messageID);
} catch (error) { message.send("❌ | " + error.message);
		}
	}
}
