// DOM Elements
const signalingInput = document.getElementById("signaling-input");
const signalingSendButton = document.getElementById("signaling-send-button");
const signalingMessages = document.getElementById("signaling-messages");

// DOM elements for chat
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const chatMessages = document.getElementById("chat-messages");

// Disable chat input by default
messageInput.disabled = true;
sendButton.disabled = true;

// Global WebRTC objects
let peerConnection;
let dataChannel;
const servers = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// App State
let role = null; // "caller" or "callee"


// Enable chat once connection is live
function setupDataChannelEvents(channel) {
    channel.onopen = () => {
        addSignalingMessage("✅ Data channel is open. You can now chat!", "received");

        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    };

    channel.onclose = () => {
        addSignalingMessage("⚠️ Data channel closed.", "received");

        messageInput.disabled = true;
        sendButton.disabled = true;
    };

    channel.onmessage = (event) => {
        const msgDiv = document.createElement("div");
        msgDiv.textContent = event.data;
        msgDiv.className = "message received";
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };
}



// Helper to add message to signaling panel
function addSignalingMessage(message, type = "system") {
    const msgDiv = document.createElement('div');
    msgDiv.textContent = message;
    msgDiv.className = `message ${type}`;
    signalingMessages.appendChild(msgDiv);
    signalingMessages.scrollTop = signalingMessages.scrollHeight;
}


// Caller-specific function
async function startCaller() {
    peerConnection = new RTCPeerConnection(servers);

    // Create data channel
    dataChannel = peerConnection.createDataChannel("chat");
    setupDataChannelEvents(dataChannel);

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate === null) {
            // When gathering is complete, show offer
            const offerSDP = JSON.stringify(peerConnection.localDescription);
            addSignalingMessage("📤 Your Offer SDP (copy and send to callee):", "received");
            addSignalingMessage(offerSDP, "sent");
        }
    };

    // Create offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
}


async function startCallee(offerSDP) {
    try {
        const offer = new RTCSessionDescription(JSON.parse(offerSDP));

        peerConnection = new RTCPeerConnection(servers);

        // Listen for data channel
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannelEvents(dataChannel);
        };

        // Set the received offer as remote description
        await peerConnection.setRemoteDescription(offer);

        // When ICE gathering is done, send answer SDP
        peerConnection.onicecandidate = (event) => {
            if (event.candidate === null) {
                const answerSDP = JSON.stringify(peerConnection.localDescription);
                addSignalingMessage("📤 Your Answer SDP (copy and send to caller):", "received");
                addSignalingMessage(answerSDP, "sent");
            }
        };

        // Create and set local answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

    } catch (err) {
        addSignalingMessage("❌ Failed to parse or use offer SDP. Make sure it's valid.", "received");
        console.error(err);
    }
}



// Event Listener for signaling "Send" button
signalingSendButton.addEventListener("click", () => {
    const input = signalingInput.value;
    signalingInput.value = "";

    addSignalingMessage(input, "sent");


    // Handle role assignment
    if (role === null) {
        if (input === "caller" || input === "callee") {
            role = input;
            addSignalingMessage(`✅ ${role.charAt(0).toUpperCase() + role.slice(1)} role assigned.`, "received");
            if (role === "caller") {
                startCaller(); // 👈 Start caller logic
            } else {
                addSignalingMessage("📥 Waiting for offer SDP. Paste it here when received.", "received");
            }
        } else {
            addSignalingMessage("❌ Invalid role. Please type 'caller' or 'callee'.", "received");
        }
    } else {
        if (role === "callee") {
            // Assume this is an offer SDP and try to use it
            startCallee(input);
        } else if (role === "caller") {
            try {
                const answer = new RTCSessionDescription(JSON.parse(input));
                peerConnection.setRemoteDescription(answer).then(() => {
                    addSignalingMessage("✅ Answer received and connection established!", "received");
                });
            } catch (err) {
                addSignalingMessage("❌ Failed to parse or apply answer SDP. Make sure it's valid.", "received");
                console.error(err);
            }
        } else {
            addSignalingMessage(`Role already set as '${role}'. No action needed.`, "received");
        }
    }
});


sendButton.addEventListener("click", () => {
    const message = messageInput.value.trim();
    if (message === "") return;

    // Send through data channel
    dataChannel.send(message);

    // Display in UI
    const msgDiv = document.createElement("div");
    msgDiv.textContent = message;
    msgDiv.className = "message sent";
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    messageInput.value = "";
});




