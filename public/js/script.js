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

socket.on("deleteTypingMsg", () => {
    document.querySelectorAll(".typing-msg").forEach((msg) => {
        msg.remove();
    });
});

socket.on("deleteMessage", (details) => {
    document.getElementsByName(details.username).forEach((msg) => {
        const chatMessage = msg.parentNode.parentNode;
        const children = chatMessage.children;
        const text = children[1].innerText;
        if (text === details.text) {
            const time = children[0].children[1].innerText;
            if (time === details.time) {
                chatMessage.remove();
            }
        }
    });
});

socket.on("deleteFile", (details) => {
    document.getElementsByName(details.username).forEach((msg) => {
        const chatMessage = msg.parentNode.parentNode;
        const children = chatMessage.children;
        const file = children[1].src;
        if (file === details.file) {
            const time = children[0].children[1].innerText;
            if (time === details.time) {
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

        const bigMsg = parent.parent()[0].innerHTML.trim();
        console.log(bigMsg);
        const start = bigMsg.lastIndexOf('"') + 2;
        const end = bigMsg.lastIndexOf("<");

        let text = bigMsg.substring(start, end).trim();
        let username = parent[0].innerHTML.trim().substring(12, lastIndex);
        let name = parent.children()[0].innerHTML;
        let time = parent.children()[1].innerHTML;

        socket.emit("deleteMessage", { username, time, text, room });
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
        socket.emit("base64 file", msg);
    };
    reader.readAsDataURL(data);
}

socket.on("base64 file", (msg) => {
    // console.log(msg);
    const div = document.createElement("div");
    div.classList.add("message");
    div.innerHTML = `<p class="meta"><span name=${msg.username} class="name">${msg.name}</span> <span>${msg.time}</span></p>
    <img src="${msg.file}">`;
    div.classList.add("file-div", "sender");

    chatMessages.appendChild(div);
    const btn = document.createElement("button");
    btn.classList.add("btn", "btn-sm", "btn-info", "delete-btn-file");
    btn.innerHTML = "Delete";
    div.childNodes[0].appendChild(btn);

    $(".delete-btn-file").unbind();
    $(".delete-btn-file").click(function () {
        const parent = $(this).parent();
        const lastIndex = parent[0].innerHTML.trim().indexOf('"', 12);

        const bigMsg = parent.parent()[0].innerHTML.trim();
        const start = bigMsg.indexOf("img src=") + 9;
        const end = bigMsg.lastIndexOf('"');

        let file = bigMsg.substring(start, end).trim();
        let username = parent[0].innerHTML.trim().substring(12, lastIndex);
        let name = parent.children()[0].innerHTML;
        let time = parent.children()[1].innerHTML;

        socket.emit("deleteFile", { username, time, file, room });
    });

    // scrollTop();             not working for 1st 2 images idk why
    setTimeout(scrollTop, 0);
});

function scrollTop() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
