require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./schemas/user_schema.js");
const Activeuser = require("./schemas/activeuser_schema.js");

MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/chatDB";

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

async function userJoin(id, username, room) {
    const record = await User.findOne({username});
    const user = { id, username: record.username, name: record.name, room };

    const activeuser = new Activeuser({_id: id, username: record.username, name: record.name, room});
    const res = await activeuser.save();
    return user;
}

async function userLeave(id) {
    const user = await Activeuser.findOneAndRemove({_id: id}); 
    return user;
}

async function getRoomUsers(room) {
    const roomUsers = await Activeuser.find({room: room});
    return roomUsers;
}

module.exports = {
    userJoin,
    userLeave,
    getRoomUsers
}