if (process.env.NODE_ENV !== "production") {
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
const { v4: uuidv4 } = require("uuid");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const moment = require("moment-timezone");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const PORT = process.env.PORT || 3000;
const MONGODB_URI =
    process.env.MONGODB_URI || "mongodb://localhost:27017/chatDB";
const botName = "Admin";

const User = require("./utils/schemas/user_schema");
const Room = require("./utils/schemas/room_schema");
const Message = require("./utils/schemas/message_schema");
const Link = require("./utils/schemas/link_schema");
const Activeuser = require("./utils/schemas/activeuser_schema");

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

initialisePassport(passport);

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(flash());
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
    })
);
app.use(passport.initialize());
app.use(passport.session());

const storage = multer.diskStorage({
    destination: "./public/uploads/",
    filename: function (req, file, cb) {
        cb(
            null,
            file.fieldname + "-" + Date.now() + path.extname(file.originalname)
        );
    },
});

const upload = multer({ storage: storage }).single("image");

let created, failure, msg, wrong;
let username, room;

io.on("connection", async (socket) => {
    socket.on("joinRoom", async (obj) => {
        username = obj.url.split("/")[3];
        const user = await userJoin(socket.id, username, obj.room);
        socket.join(user.room);

        let message = await formatMessage(
            botName,
            `Welcome ${user.name}!`,
            user.room
        );
        socket.emit("message", message);

        message = await formatMessage(
            botName,
            `${user.name} has joined the room!`,
            user.room
        );
        socket.broadcast.to(user.room).emit("message", message);

        const temp = await getRoomUsers(user.room);
        io.to(user.room).emit("roomUsers", {
            room: user.room,
            users: temp,
        });

        socket.on("chatMessage", async (msg) => {
            msg = await formatMessage(user.username, msg, user.room);
            msg.id = socket.id;
            io.to(user.room).emit("message", msg);
        });

        socket.on("image", async (file) => {
            const images = await Message.find({
                username: user.username,
                room: user.room,
                type: "image",
            });
            const image = images[images.length - 1];

            if (!image || image.originalname !== file.originalname) {
                socket.emit("temp", file); // file uploading may not have finished if the image is large in size
            } else {
                io.to(user.room).emit("image", image);
            }
        });

        socket.on("typing", async () => {
            const msg = await formatMessage(
                botName,
                `${user.name} is typing a message..`,
                user.room
            );
            socket.broadcast.to(user.room).emit("message", msg);
        });

        socket.on("notTyping", () => {
            socket.broadcast.to(user.room).emit("deleteTypingMsg");
        });

        socket.on("deleteMessage", (details) => {
            Message.deleteOne(details, (err, result) => {
                if (!err) {
                    io.to(user.room).emit("deleteMessage", details);
                } else {
                    console.log(err);
                }
            });
        });

        socket.on("deleteFile", (details) => {
            Message.deleteOne(details, (err, result) => {
                if (!err) {
                    io.to(user.room).emit("deleteFile", details);

                    fs.unlink("./public/uploads/" + details.filename, (err) => {
                        if (err) {
                            console.log(err);
                        }
                    });
                } else {
                    console.log(err);
                }
            });
        });

        socket.on("disconnect", async () => {
            const currentUser = await userLeave(socket.id);

            message = await formatMessage(
                botName,
                `${currentUser.name} has left the room`,
                user.room
            );
            io.to(currentUser.room).emit("message", message);

            let roomUsers = await getRoomUsers(currentUser.room);
            io.to(currentUser.room).emit("roomUsers", {
                room: currentUser.room,
                users: roomUsers,
            });
        });
    });
});

app.get("/", checkAuthenticated, (req, res) => {
    res.redirect("/" + req.user.username + "/rooms");
});

app.get("/login", checkNotAuthenticated, (req, res) => {
    res.render("index", { created: created, failure: failure, msg: msg });
    created = failure = msg = undefined;
});

app.post(
    "/login",
    checkNotAuthenticated,
    passport.authenticate("local", {
        successRedirect: "/temp",
        failureRedirect: "/login",
        failureFlash: true,
    })
);

app.get("/temp", checkAuthenticated, (req, res) => {
    res.redirect("/" + req.user.username + "/rooms");
});

app.get("/signup", checkNotAuthenticated, (req, res) => {
    res.render("signup", { failure: failure, msg: msg });
    failure = msg = undefined;
});

app.post("/signup", checkNotAuthenticated, (req, res) => {
    const { email, username, name, password } = req.body;

    User.findOne(
        { $or: [{ email: email }, { username: username }] },
        (err, user) => {
            if (!err) {
                if (user) {
                    failure = true;
                    msg = "Email/username is registered already";
                    res.redirect("/signup");
                } else {
                    if (username.toLowerCase() === "admin") {
                        failure = true;
                        msg = "username can't be admin";
                        res.redirect("/signup");
                    } else {
                        bcrypt.hash(password, saltRounds, (err, hash) => {
                            if (!err) {
                                const user = new User({
                                    email,
                                    username,
                                    name,
                                    password: hash,
                                });
                                user.save((err) => {
                                    if (!err) {
                                        created = true;
                                        msg = "Account created successfully!";
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
        }
    );
});

app.get("/forgot", checkNotAuthenticated, (req, res) => {
    res.render("forgot", { failure: failure, msg: msg });
    failure = msg = undefined;
});

app.post("/forgot", checkNotAuthenticated, (req, res) => {
    User.findOne({ email: req.body.email }, async (err, user) => {
        if (!err) {
            if (user) {
                const uuid = uuidv4();
                const newId = new Link({ uuid, username: user.username });

                newId
                    .save()
                    .then(() => {
                        const toSend = `<p>Hey <strong>${user.name}!</strong> <br><br>
                        You have requested to reset the password for your account. <br><br>
                        To reset your password please <strong><a href="https://chaterpillar.herokuapp.com/reset/${uuid}" style="text-decoration: none;">Click here!</a></strong></p>
                        `;
                        const message = {
                            to: req.body.email,
                            from: process.env.SENDER_EMAIL,
                            subject: "Reset password",
                            html: toSend,
                        };

                        sgMail
                            .send(message)
                            .then(() => {
                                created = true;
                                msg = "Check your email!";
                                res.redirect("/login");
                            })
                            .catch((err) => console.log(err));
                    })
                    .catch((err) => console.log(err));
            } else {
                failure = true;
                msg = "Account with this email doesn't exist!";
                res.redirect("/forgot");
            }
        } else {
            console.log(err);
        }
    });
});

app.get("/reset/:uuid", checkNotAuthenticated, (req, res) => {
    const uuid = req.params.uuid;

    Link.findOne({ uuid }, (err, record) => {
        if (!err) {
            if (record) {
                res.render("reset", { uuid });
            } else {
                res.render("err", {
                    title: "URL Expired!",
                    msg:
                        "You have used this url to reset your password once and cannot be used again.",
                });
            }
        } else {
            console.log(err);
        }
    });
});

app.post("/reset", checkNotAuthenticated, (req, res) => {
    const uuid = req.body.uuid;
    const password = req.body.password;

    bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (!err) {
            try {
                const record = await Link.findOne({ uuid });
                const username = record.username;

                const updatedRecord = await User.findOneAndUpdate(
                    { username },
                    { password: hash },
                    { useFindAndModify: false }
                );
                const result = await Link.findOneAndDelete(
                    { uuid },
                    { useFindAndModify: false }
                );

                created = true;
                msg = "Password updated!";
                res.redirect("/login");
            } catch (err) {
                console.log(err);
            }
        } else {
            console.log(err);
        }
    });
});

app.get("/:username/rooms", checkAuthenticated, (req, res) => {
    if (req.params.username !== req.user.username) {
        checkNotAuthenticated(req, res);
    } else {
        Room.find({}, (err, rooms) => {
            if (!err) {
                res.render("rooms", {
                    failure: failure,
                    msg: msg,
                    rooms: rooms,
                    username: req.params.username,
                });
                failure = msg = undefined;
            } else {
                console.log(err);
            }
        });
    }
});

app.post("/rooms", checkAuthenticated, (req, res) => {
    room = req.body.roomName.trim();
    const notAllowed = "#`$^*()-+[]{}/\\'\".,:;";

    for (let i = 0; i < room.length; i++) {
        if (notAllowed.includes(room.charAt(i))) {
            wrong = true;
            break;
        }
    }

    if (wrong) {
        wrong = undefined;
        failure = true;
        msg = notAllowed + " are not allowed in room names";
        res.redirect("/" + req.user.username + "/rooms");
    } else {
        Room.findOne(
            { name: { $regex: new RegExp(room, "i") } },
            (err, record) => {
                if (!err) {
                    if (!record) {
                        User.findOne(
                            { username: req.user.username },
                            (err, record) => {
                                if (!err) {
                                    const newRoom = new Room({
                                        name: room,
                                        creator: record.name,
                                    });

                                    newRoom.save((err) => {
                                        if (!err) {
                                            res.redirect(
                                                "/" +
                                                    req.user.username +
                                                    "/rooms/" +
                                                    room
                                            );
                                        } else {
                                            console.log(err);
                                        }
                                    });
                                } else {
                                    console.log(err);
                                }
                            }
                        );
                    } else {
                        failure = true;
                        msg = "Room exists already";
                        res.redirect("/" + req.user.username + "/rooms");
                    }
                } else {
                    console.log(err);
                }
            }
        );
    }
});

app.get("/:username/rooms/:room", checkAuthenticated, async (req, res) => {
    if (req.params.username !== req.user.username) {
        checkNotAuthenticated(req, res);
    } else {
        Room.findOne(
            { name: { $regex: new RegExp(req.params.room, "i") } },
            (err, room) => {
                if (!err) {
                    if (room) {
                        Message.find({ room: room.name }, (err, messages) => {
                            if (!err) {
                                res.render("chat", {
                                    roomName: room.name,
                                    messages: messages,
                                    currentUsername: req.params.username,
                                });
                            } else {
                                console.log(err);
                            }
                        });
                    } else {
                        failure = true;
                        msg = req.params.room + " doesn't exist";
                        res.redirect("/" + req.params.rooms + "/rooms");
                    }
                } else {
                    console.log(err);
                }
            }
        );
    }
});

app.post("/upload", checkAuthenticated, async (req, res) => {
    const activeUser = await Activeuser.findOne({
        username: req.user.username,
    });

    const details = {
        username: activeUser.username,
        name: activeUser.name,
        type: "image",
        room: activeUser.room,
        time: moment().tz("Asia/Kolkata").format("h:mm a"),
        date: moment().format("DD-MMM-YYYY"),
    };

    upload(req, res, (err) => {
        if (!err) {
            details.filename = req.file.filename;
            details.originalname = req.file.originalname;
            details.path = "\\" + req.file.path.substring(7);

            const image = new Message(details);
            image.save((err) => {
                if (err) {
                    console.log(err);
                }
            });
        } else {
            console.log(err);
        }
    });
});

app.post("/logout", checkAuthenticated, (req, res) => {
    req.logOut();
    res.redirect("/login");
});

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect("/login");
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect("/");
    }
    next();
}

app.use((req, res) => {
    res.status(400);
    res.render("err", {
        title: "Oops!",
        msg: "This path doesn't exist!",
    });
});

server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
