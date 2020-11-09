const mongoose = require("mongoose");

const activeuserSchema = new mongoose.Schema({
    _id: String,
    username: String,
    name: String,
    room: String,
});

module.exports = new mongoose.model("Activeuser", activeuserSchema);
