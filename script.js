let peerConnection;
let databaseURL;
let dataChannel;
const servers = {'iceServers': [{'urls': ['stun:stun.l.google.com:19302']}]}
const messagesDiv = document.getElementById('chat-messages');
const sendButton = document.getElementById('send-button');
const messageBox =  document.getElementById('message-input');
messageBox.disabled = true;
sendButton.disabled = true;

let getDatabaseURL = () => {
    databaseURL = localStorage.getItem("databaseURL");
    if (databaseURL === null) {
        databaseURL = prompt("Enter Database url:");
        localStorage.setItem("databaseURL", databaseURL);
    }
}

async function getDataFromBase() {
    try {
        const response = await fetch(databaseURL);
        
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting data:', error);
    }
}

async function setDataInBase(type, msg) {
    const msgData = {
        reqType: type,
        reqMessage: msg,
    };
    
    fetch(databaseURL, {
        method: 'PUT', // Use PUT to create or replace data
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(msgData)
    })
    .then(response => {
        if (!response.ok) {
            console.error('Error saving data:', response.statusText);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

async function deleteDataInBase() {
    fetch(databaseURL, {
        method: 'DELETE'
    });
}

function setDataChannelEvents() {
    // Enable textarea and button when opened
    dataChannel.addEventListener('open', event => {
        messageBox.disabled = false;
        messageBox.focus();
        sendButton.disabled = false;
    });

    // Disable input when closed
    dataChannel.addEventListener('close', event => {
        messageBox.disabled = true;
        sendButton.disabled = true;
    });

    // Append new messages to the box of incoming messages
    dataChannel.addEventListener('message', event => {
        const message = event.data;
        const newMessage = document.createElement('div');
        newMessage.textContent = message;
        newMessage.className = "message received";
        messagesDiv.appendChild(newMessage);
    });
}

let createPeerConnection = async () => {
    const dataResp = await getDataFromBase();
    peerConnection = new RTCPeerConnection(servers);

    if (dataResp === null) {
        let timer;
        dataChannel = peerConnection.createDataChannel("MessageChannel");
        setDataChannelEvents();
        peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                await setDataInBase('offer', JSON.stringify(peerConnection.localDescription));
                console.log("Offer Set");
            }
            
        }

        let offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        timer = setInterval(async () => {
            const response = await getDataFromBase();
            console.log("check answer");
            if (response && response.reqType == "answer") {
                clearInterval(timer);
                let currentAnswer = JSON.parse(response.reqMessage);
                await peerConnection.setRemoteDescription(currentAnswer);
                await deleteDataInBase();
                console.log("answer set");
            }
        }, 5000);

    } else if (dataResp.reqType == "offer") {
        peerConnection.addEventListener('datachannel', event => {
            dataChannel = event.channel;
            setDataChannelEvents();
        });
        const currentOffer = JSON.parse(dataResp.reqMessage);
        await peerConnection.setRemoteDescription(currentOffer);

        peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                await setDataInBase('answer', JSON.stringify(peerConnection.localDescription));
                console.log("answer set");
            }
        }

        let answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
    }
}


let messages = [
                // ["Hello! How are you?","remote"],
                // ["Im good thanks wbu?","local"],
                // ["Also good what you up to?","remote"],
                // ["you know the usual","local"],
                // ["Hello! How are you?","remote"],
                // ["Im good thanks wbu?","local"],
                // ["Also good what you up to?","remote"],
                // ["you know the usual","local"],
                // ["Hello! How are you?","remote"],
                // ["Im good thanks wbu?","local"],
                // ["Also good what you up to?","remote"],
                // ["you know the usual","local"],
                // ["Hello! How are you?","remote"],
                // ["Im good thanks wbu?","local"],
                // ["Also good what you up to?","remote"],
                // ["you know the usual","local"],
                // ["Hello! How are you?","remote"],
                // ["Im good thanks wbu?","local"],
                // ["Also good what you up to?","remote"],
                // ["you know the usual","local"],
                // ["Hello! How are you?","remote"],
                // ["Im good thanks wbu?","local"],
                // ["Also good what you up to?","remote"],
                // ["you know the usual","local"],
                // ["Hello! How are you?","remote"],
                // ["Im good thanks wbu?","local"],
                // ["Also good what you up to?","remote"],
                // ["you know the usual","local"],
                ];

for (let i = 0; i < messages.length; i++) {
    const element = messages[i];
    if (element[1] === "remote") {
        const newMessage = document.createElement('div');
        newMessage.textContent = element[0];
        newMessage.className = "message received";
        messagesDiv.appendChild(newMessage);
    } else {
        const newMessage = document.createElement('div');
        newMessage.textContent = element[0];
        newMessage.className = "message sent";
        messagesDiv.appendChild(newMessage);        
    }    
}

window.onload = () => {
    var objDiv = document.getElementById("scrollable-div");
    objDiv.scrollTop = objDiv.scrollHeight;
    getDatabaseURL();
    createPeerConnection();
}

window.onbeforeunload = async () => {
    console.log("leaving");
    await deleteDataInBase();
    return "Clearing Database";
}

sendButton.addEventListener('click', () => {
    const message = messageBox.value;
    const newMessage = document.createElement('div');
    newMessage.textContent = message;
    newMessage.className = "message sent";
    messagesDiv.appendChild(newMessage);
    messageBox.cl
    dataChannel.send(message);
    messageBox.value = "";
});