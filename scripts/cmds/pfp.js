module.exports = {
  config: {
    name: "profile",
    aliases: ["pfp", "pp"],
    version: "1.6",
    author: "TawsiN",
    countDown: 20,
    role: 0,
    shortDescription: "Displays a user's profile image",
    longDescription: "Fetches and displays the profile image of the user who sent the command, a tagged user, or the user whose message is replied to.",
    category: "Image",
    guide: {
      en: "{pn} @tag - Show the profile image of the tagged user\n{pn} - Show your profile image\n{pn} <uid> - Show the profile image of a specific user\nUse the command as a reply to a message to display the profile image of the person whose message you're replying to."
    }
  },

  onStart: async function ({ event, message, usersData, args }) {
    try {
      let userId = event.senderID; // Default to the command sender

      // Check for UID argument
      if (args[0] && /^\d+$/.test(args[0])) {
        userId = args[0];
      } 
      // Check if a user is tagged
      else if (Object.keys(event.mentions)[0]) {
        userId = Object.keys(event.mentions)[0];
      } 
      // Check if the command is used as a reply
      else if (event.type === "message_reply") {
        userId = event.messageReply.senderID;
      }

      // Restricted UIDs (Prevent others from accessing your profile)
      const restrictedUids = ["100080195076753"]; // Add your UID here

      if (restrictedUids.includes(userId) && userId !== event.senderID) {
        return message.reply("You don't have permission to access this information.");
      }

      // Fetch profile picture
      const avatarUrl = await usersData.getAvatarUrl(userId);
      if (!avatarUrl) {
        return message.reply("Couldn't fetch the profile picture. Try again later.");
      }

      // Send only the image, no text
      message.reply({
        attachment: await global.utils.getStreamFromURL(avatarUrl),
      });

    } catch (error) {
      console.error("Error fetching profile picture:", error);
      message.reply("An error occurred while fetching the profile picture. Please try again later.");
    }
  }
};
