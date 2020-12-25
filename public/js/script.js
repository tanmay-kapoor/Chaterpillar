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
    setTimeout(scrollTop, 10); // not sure, maybe because whole image not loaded instantly
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

socket.on("deleteFile", (details) => {
    document.getElementsByName(details.username).forEach((msg) => {
        const chatMessage = msg.parentNode.parentNode;
        const children = chatMessage.children;

        // if img tag exists only then deal with msg else skip
        if (children[1].children[0]) {
            const filename = children[1].children[0].alt;

            if (filename === details.filename) {
                chatMessage.remove();
            }
        }
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

    if (msg.name !== "Admin") {
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
        const lastIndex = parent[0].innerHTML.trim().indexOf('"', 12);

        const username = parent[0].innerHTML.trim().substring(12, lastIndex);
        const timestamp = parent.parent()[0].id;

        socket.emit("deleteMessage", { username, room, timestamp });
    });
}

socket.on("temp", (file) => {
    socket.emit("image", file); // re emit hoping that file has been uploaded
});

document.getElementById("file-input").onchange = function (e) {
    this.form.submit();
    const file = {
        originalname: this.files[0].name,
    };
    setTimeout(() => socket.emit("image", file), 20); // file uploading takes a lil time and this might emit before uploading so small delay
    $("#file-input").prop("value", ""); // to allow same file to be selected again
};

function outputFile(msg) {
    const div = document.createElement("div");
    div.setAttribute("id", msg.timestamp);
    div.classList.add("message");

    div.innerHTML = `<p class="meta"><span name=${msg.username} class="name">${msg.name}</span> <span>${msg.time}</span></p>
    <p class="text"><img src="${msg.path}" alt="${msg.filename}"></p>`;
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
        const lastIndex = parent[0].innerHTML.trim().indexOf('"', 12);
        const img = parent.parent().children().children()[3];

        const username = parent[0].innerHTML.trim().substring(12, lastIndex);
        const filename = img.alt;
        const timestamp = parent.parent()[0].id;

        socket.emit("deleteFile", { username, room, filename, timestamp });
    });
}
