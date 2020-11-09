const mongoose = require("mongoose");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");

const User = require("./utils/schemas/user_schema.js");
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

async function getUserByUsername(username) {
    try {
        const user = await User.findOne({ username });
        return user;
    } catch (err) {
        console.log(err);
    }
}

async function getUserById(id) {
    try {
        const user = await User.findOne({ _id: id });
        return user;
    } catch (err) {
        console.log(err);
    }
}

function initialise(passport) {
    passport.use(
        new LocalStrategy({ usernameField: "username" }, authenticateUser)
    );
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });
    passport.deserializeUser(async (id, done) => {
        return done(null, await getUserById(id));
    });
}

async function authenticateUser(username, password, done) {
    const user = await getUserByUsername(username);

    if (!user) {
        return done(null, false, {
            message: "This username is not associated with an account",
        });
    }

    try {
        if (await bcrypt.compare(password, user.password)) {
            return done(null, user);
        } else {
            return done(null, false, { message: "Incorrect password" });
        }
    } catch (err) {
        return done(err);
    }
}

module.exports = initialise;
