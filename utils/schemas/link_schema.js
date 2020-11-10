const mongoose = require("mongoose");

const linkSchema = new mongoose.Schema({
    uuid: String,
    username: String,
});

module.exports = new mongoose.model("Link", linkSchema);
