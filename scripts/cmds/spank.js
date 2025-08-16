const DIG = require("discord-image-generation");
const fs = require("fs-extra");

module.exports = {
	config: {
		name: "spank",
     aliases: [],
		version: "1.1",
		author: "NTKhang & Tawsif~",
		countDown: 5,
		role: 0,
		shortDescription: "",
		longDescription: "spank someone",
		category: "fun",
		guide: {
			en: "   {pn} @tag | reply"
		}
	},

	langs: {
		vi: {
			noTag: "Bạn phải tag người bạn muốn tát"
		},
		en: {
			noTag: "You must tag or reply the person you want to slap"
		}
	},

	onStart: async function ({ event, message, usersData, args, getLang }) {
		const uid1 = event.senderID;
		let uid2 = Object.keys(event.mentions)[0];
if (event.type === "message_reply") {
uid2 = event.messageReply.senderID;}
		if (!uid2)
			return message.reply(getLang("noTag"));
		const avatarURL1 = await usersData.getAvatarUrl(uid1);
		const avatarURL2 = await usersData.getAvatarUrl(uid2);
		const img = await new DIG.Spank().getImage(avatarURL1, avatarURL2);
		const pathSave = `${__dirname}/tmp/${uid1}_${uid2}Batslap.png`;
		fs.writeFileSync(pathSave, Buffer.from(img));
		const content = args.join(' ').replace(Object.keys(event.mentions)[0], "");
		message.reply({
			body: `${(content || "smash")}`,
			attachment: fs.createReadStream(pathSave)
		}, () => fs.unlinkSync(pathSave));
	}
};
