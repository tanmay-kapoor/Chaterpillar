const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    email: String,
    username: String,
    name: String,
    password: String,
});

module.exports = new mongoose.model("User", userSchema);
