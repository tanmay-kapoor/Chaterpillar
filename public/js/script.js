const roomName = document.getElementById("room-name");
const usersList = document.getElementById("users");
const chatMessages = document.querySelector(".chat-messages");
const room = roomName.innerText;
const usernameFromURL = document.URL.split("/")[3];

const socket = io();

socket.emit("joinRoom", { room, url: document.URL });

socket.on("roomUsers", ({ room, users }) => {
    updateSideBar(room, users);
});

socket.on("message", (msg) => {
    if (msg.text.trim() !== "") {
        outputMessage(msg); // passing socket.id sice msg.username can be repeated for users
        scrollTop();
    }
});

socket.on("image", (msg) => {
    // console.log(msg);
    outputFile(msg);

    // scrollTop();             not working for 1st 2 images idk why
    setTimeout(scrollTop, 0);
});

socket.on("deleteTypingMsg", () => {
    document.querySelectorAll(".typing-msg").forEach((msg) => {
        msg.remove();
    });
});

socket.on("deleteMessage", (details) => {
    const messages = Array.from(document.getElementsByName(details.username));

    messages.every((msg) => {
        const chatMessage = msg.parentNode.parentNode;

        if (chatMessage.id === details.timestamp) {
            chatMessage.remove();
            return false;
        }
        return true;
    });
});

let first = true,
    timeout;

const sendBtn = document.querySelector(".send-btn");
sendBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const msg = document.getElementById("msg").value;
    document.getElementById("msg").value = "";
    socket.emit("chatMessage", msg);

    timeoutFunction();
});

const msgArea = document.querySelector("#msg");
msgArea.addEventListener("keypress", () => {
    if (first) {
        first = false;
        socket.emit("typing");
        clearTimeout(timeout);
        timeout = setTimeout(timeoutFunction, 3000);
    }
});

function timeoutFunction() {
    first = true;
    socket.emit("notTyping");
}

function scrollTop() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateSideBar(room, users) {
    usersList.innerHTML = ""; //clear users list when new user joined and form again
    users.forEach((user) => {
        const ul = document.createElement("ul");
        ul.innerText = user.name;
        if (user.id === socket.id) {
            ul.innerText += " (You)";
        }
        usersList.appendChild(ul);
    });
}

function outputMessage(msg) {
    const div = document.createElement("div");
    div.classList.add("message");

    div.innerHTML = `<p class="meta"><span name=${msg.username} class="name">${msg.name}</span> <span>${msg.time}</span></p>
    <p class="text">${msg.text}</p>`;

    if (msg.name !== "ChaterBOT") {
        div.setAttribute("id", msg.timestamp);
        div.classList.add("not-bot");

        if (msg.id === socket.id) {
            div.classList.add("sender");

            const btn = document.createElement("button");
            btn.classList.add("btn", "btn-sm", "btn-info", "delete-btn");
            btn.innerHTML = "Delete";
            div.childNodes[0].appendChild(btn);
        }
    } else {
        if (msg.text.includes("is typing a message..")) {
            div.classList.add("typing-msg");
        }
    }
    chatMessages.appendChild(div);

    $(".delete-btn").unbind();
    $(".delete-btn").click(function () {
        const parent = $(this).parent();
        const line = parent[0].innerHTML.trim();
        const lastIndex = line.indexOf('"', 12);

        const username = line.substring(12, lastIndex);
        const timestamp = parent.parent()[0].id;
        socket.emit("deleteMessage", { username, room, timestamp });
    });
}

$("#file-input").bind("change", function (e) {
    // const data = e.originalEvent.target.files[0];
    // readThenSendFile(data);
    const files = document.getElementById("file-input").files;

    //forEach gives error idk why
    for (let i = 0; i < files.length; i++) {
        readThenSendFile(files[i]);
    }
    $("#file-input").prop("value", ""); // to allow same file to be selected again
});

function readThenSendFile(data) {
    var reader = new FileReader();
    reader.onload = function (evt) {
        var msg = {};
        msg.username = usernameFromURL;
        msg.file = evt.target.result;
        msg.fileName = data.name;
        socket.emit("image", msg);
    };
    reader.readAsDataURL(data);
}

function outputFile(msg) {
    const div = document.createElement("div");
    div.setAttribute("id", msg.timestamp);
    div.classList.add("message");
    div.innerHTML = `<p class="meta"><span name=${msg.username} class="name">${msg.name}</span> <span>${msg.time}</span></p>
    <p class="text"><img src="${msg.file}" alt="${msg.fileName}"></p>`;
    div.classList.add("file-div");

    if (msg.username === usernameFromURL) {
        div.classList.add("sender");
        const btn = document.createElement("button");
        btn.classList.add("btn", "btn-sm", "btn-info", "delete-btn");
        btn.innerHTML = "Delete";
        div.childNodes[0].appendChild(btn);
    }

    chatMessages.appendChild(div);

    $(".delete-btn").unbind();
    $(".delete-btn").click(function () {
        const parent = $(this).parent();
        const line = parent[0].innerHTML.trim();
        const lastIndex = line.indexOf('"', 12);

        const username = line.substring(12, lastIndex);
        const timestamp = parent.parent()[0].id;
        socket.emit("deleteMessage", { username, timestamp });
    });
}
