require("dotenv").config();
const { tz } = require("moment-timezone");
const moment = require("moment-timezone");
const mongoose = require("mongoose");
const Message = require("./schemas/message_schema.js");
const User = require("./schemas/user_schema.js");

MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/chatDB";

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

async function formatMessage(username, text, room) {
    const details = {
        username,
        name: "ChaterBOT",
        text,
        time: moment().tz("Asia/Kolkata").format("h:mm a"),
        date: moment().tz("Asia/Kolkata").format("DD-MMM-YYYY"),
        type: "text",
    };

    if (username !== "ChaterBOT") {
        const record = await User.findOne({ username });
        let temp = details;
        temp.room = room;
        temp.name = record.name;
        temp.timestamp = Date.now();

        if (text !== "") {
            const message = new Message(temp);

            message.save((err) => {
                if (!err) {
                    return details;
                } else {
                    console.log(err);
                }
            });
        }
    }
    return details;
}

module.exports = formatMessage;
