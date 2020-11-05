const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    username: String,
    name: String,
    text: String,
    time: String,
    room: String
});

module.exports = new mongoose.model("Message", messageSchema);