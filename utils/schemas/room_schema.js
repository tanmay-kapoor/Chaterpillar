const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
    name: String,
    creator: String,
});

module.exports = new mongoose.model("Room", roomSchema);
