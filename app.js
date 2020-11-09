if(process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}
const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const saltRounds = 10;
const formatMessage = require("./utils/messages");
const { userJoin, userLeave, getRoomUsers } = require("./utils/users");
const passport = require("passport");
const initialisePassport = require("./passport-config");
const flash = require("express-flash");
const session = require("express-session");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/chatDB";
const botName = "Admin";

const User = require("./utils/schemas/user_schema.js");
const Room = require("./utils/schemas/room_schema.js");
const Message = require("./utils/schemas/message_schema.js");

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

initialisePassport(passport);

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(flash());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

let created, failure, msg, wrong;
let username, room;

io.on("connection", async(socket) => {
    socket.on("joinRoom", async(obj) => {
        username = obj.url.split("/")[3];
        const user = await userJoin(socket.id, username, obj.room);
        socket.join(user.room);

        let message = await formatMessage(botName, `Welcome ${user.name}!`, user.room);
        socket.emit("message", message);

        message = await formatMessage(botName, `${user.name} has joined the room!`, user.room);
        socket.broadcast.to(user.room).emit("message", message);

        const temp = await getRoomUsers(user.room);
        io.to(user.room).emit("roomUsers", {
            room: user.room,
            users: temp
        });
    
        socket.on("chatMessage", async(msg) => {
            msg = await formatMessage(user.username, msg, user.room);
            msg.id = socket.id;
            io.to(user.room).emit("message", msg);
        });

        socket.on("typing", async() => {
            const msg = await formatMessage(botName, `${user.name} is typing a message..`, user.room);
            socket.broadcast.to(user.room).emit("message", msg);
        });

        socket.on("notTyping", () => {
            socket.broadcast.to(user.room).emit("deleteTypingMsg");
        });

        socket.on("deleteMessage", details => {
            Message.deleteOne(details, (err,  result) => {
                if(!err) {
                    io.to(user.room).emit("deleteMessage", details);     
                } else {
                    console.log(err);
                }
            });
        });

        socket.on("disconnect", async() => {
            const currentUser = await userLeave(socket.id);

            message = await formatMessage(botName, `${currentUser.name} has left the room`, user.room)
            io.to(currentUser.room).emit("message", message);

            let roomUsers = await getRoomUsers(currentUser.room);
            io.to(currentUser.room).emit("roomUsers", {
                room: currentUser.room,
                users: roomUsers
            });
        });
    });
});

app.get("/", checkAuthenticated, (req, res) => {
    res.redirect("/"+req.user.username+"/rooms");
});

app.get("/login", checkNotAuthenticated, (req, res) => {
    res.render("index", { created: created, failure: failure, msg: msg });
    created = failure = msg = undefined;
});

app.post("/login", checkNotAuthenticated, passport.authenticate("local", {
    successRedirect: "/temp",
    failureRedirect: "/login",
    failureFlash: true
}));

app.get("/temp", checkAuthenticated, (req, res) => {
    res.redirect("/"+req.user.username+"/rooms");
})

app.get("/signup", checkNotAuthenticated, (req, res) => {
    res.render("signup", { failure: failure, msg: msg });
    failure = msg = undefined;
});

app.post("/signup", checkNotAuthenticated, (req, res) => {
    const { email, username, name, password } = req.body;

    User.findOne({ $or: [{email: email}, {username: username}] }, (err, user) => {
        if(!err) {
            if(user) {
                failure = true; msg = "Email/username is registered already";
                res.redirect("/signup");
            } else {
                if(username.toLowerCase() === "admin") {
                    failure = true; msg = "username can't be admin";
                    res.redirect("/signup");
                } else {
                    bcrypt.hash(password, saltRounds, (err, hash) => {
                        if(!err) {
                            const user = new User({ email, username, name, password: hash });
                            user.save(err => {
                                if(!err) {
                                    created = true; msg = "Account created successfully!";
                                    res.redirect("/login");
                                } else {
                                    console.log(err);
                                }
                            });
                        } else {
                            console.log(err);
                        }
                    });
                }
            }
        } else {
            console.log(err);
        }
    });
});

app.get("/:username/rooms", checkAuthenticated, (req, res) => {
    if(req.params.username !== req.user.username) {
        checkNotAuthenticated(req, res);
    } else {
        Room.find({}, (err, rooms) => {
            if(!err) {
                res.render("rooms", {failure: failure, msg: msg, rooms: rooms, username: req.params.username});
                failure = msg = undefined;
            } else {
                console.log(err);
            }
        });
    }
});

app.post("/rooms", checkAuthenticated, (req, res) => {
    room = req.body.roomName;
    const notAllowed = "#`$^*()-+[]{}/\\\'\".,:;";

    for(let i = 0; i<room.length; i++) {
        if(notAllowed.includes(room.charAt(i))) {
            wrong = true;
            break;
        }
    }

    if(wrong) {
        wrong = undefined;
        failure = true; msg = notAllowed + " are not allowed in room names";
        res.redirect("/"+req.user.username+"/rooms");
    } else {
        Room.findOne({name: { $regex: new RegExp(room, "i") }}, (err, record) => {
            if(!err) {
                if(!record) {
                    const newRoom = new Room({name: room});
    
                    newRoom.save(err => {
                        if(!err) {
                            res.redirect("/"+req.user.username+"/rooms/"+room);
                        } else {
                            console.log(err);
                        }
                    });
                } else {
                    failure = true; msg = "Room exists already";
                    res.redirect("/"+req.user.username+"/rooms");
                }
            } else {
                console.log(err);
            }
        });
    }
});

app.get("/:username/rooms/:room", checkAuthenticated, (req, res) => {
    if(req.params.username !== req.user.username) {
        checkNotAuthenticated(req, res);
    } else {
        Room.findOne({name: { $regex: new RegExp(req.params.room, "i") }}, (err, room) => {
            if(!err) {
                if(room) {
                    Message.find({room: room.name}, (err, messages) => {
                        if(!err) {
                            res.render("chat", {roomName: room.name, messages: messages, currentUsername: req.params.username});
                        } else {
                            console.log(err)
                        }
                    });
                } else {
                    failure = true; msg = req.params.room + " doesn't exist";
                    res.redirect("/"+req.params.rooms+"/rooms");
                }
            } else {
                console.log(err);
            }
        });
    }
});

app.post("/logout", checkAuthenticated, (req, res) => {
    req.logOut();
    res.redirect("/login");
});

function checkAuthenticated(req, res, next) {
    if(req.isAuthenticated()) {
        return next();
    }
    res.redirect("/login");
}

function checkNotAuthenticated(req, res, next) {
    if(req.isAuthenticated()) {
        return res.redirect("/");
    }
    next();
}

server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));