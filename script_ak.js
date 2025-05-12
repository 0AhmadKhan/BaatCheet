// DOM Elements
const signalingInput = document.getElementById("signaling-input");
const signalingSendButton = document.getElementById("signaling-send-button");
const signalingMessages = document.getElementById("signaling-messages");

// DOM elements for chat
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const chatMessages = document.getElementById("chat-messages");
const fileInput    = document.getElementById('fileInput');
const sendFileBtn  = document.getElementById('sendFileBtn');

// Disable chat input by default
messageInput.disabled = true;
sendButton.disabled = true;

// WebRTC and Firebase state
let peerConnection;
let dataChannel;
let role = null;
let useFirebase = false;
let sessionId = null;

const servers = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};
const dbRef = firebase.database().ref();
const transfers = {};

/**
 * Display a placeholder in the chat UI for an incoming file transfer.
 * @param {string} fileId      Unique transfer ID
 * @param {string} fileName    Name of the incoming file
 * @param {number} totalChunks How many chunks we expect
 */

//UI for incoming file 
function showIncomingFileUI(fileId, fileName, totalChunks) {
    // Create a container div to hold the incoming‐file UI
    const container = document.createElement('div');
    container.id = `incoming-${fileId}`;
    container.className = 'incoming-file';
  
    // File name label
    const nameLabel = document.createElement('div');
    nameLabel.textContent = `Incoming file: ${fileName}`;
    nameLabel.className = 'incoming-file-name';
    container.appendChild(nameLabel);
  
    // Progress text
    const progressText = document.createElement('div');
    progressText.textContent = `0 / ${totalChunks} chunks received`;
    progressText.className = 'incoming-file-progress';
    container.appendChild(progressText);
  
    // Append to your chat message area (or a dedicated sidebar)
    chatMessages.appendChild(container);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  

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
        // Metadata packet?
        if (typeof event.data === 'string') {
          let meta;
          try {
            meta = JSON.parse(event.data);
          } catch {
            // not JSON → fall through to chat display
          }
          if (meta && meta.fileId && meta.totalChunks) {
            // initialize transfer state
            transfers[meta.fileId] = {
              fileName:  meta.fileName,
              mimeType:  meta.mimeType,
              fileSize:  meta.fileSize,
              chunkSize: meta.chunkSize,
              totalChunks: meta.totalChunks,
              chunks: new Array(meta.totalChunks),
              receivedCount: 0
            };
            showIncomingFileUI(meta.fileId, meta.fileName, meta.totalChunks);
            return;
          }
        }
      
        // Fallback: plain chat message
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


// === Manual Caller ===
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


// === Manual Callee ===
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


// === Firebase Mode ===
async function handleFirebaseMode() {
    const offerRef = dbRef.child(`sessions/${sessionId}/offer`);
    const answerRef = dbRef.child(`sessions/${sessionId}/answer`);

    const offerSnapshot = await offerRef.get();

    if (offerSnapshot.exists()) {
        // Act as Callee
        role = "callee";
        const offerSDP = offerSnapshot.val();
        addSignalingMessage("📥 Offer found. Acting as Callee...", "received");
        await startCalleeFirebase(offerSDP);
    } else {
        // Act as Caller
        role = "caller";
        addSignalingMessage("📤 No offer found. Acting as Caller...", "received");
        await startCallerFirebase();
    }
}


async function startCallerFirebase() {
    peerConnection = new RTCPeerConnection(servers);
    dataChannel = peerConnection.createDataChannel("chat");
    setupDataChannelEvents(dataChannel);

    peerConnection.onicecandidate = async (event) => {
        if (event.candidate === null) {
            const offerSDP = JSON.stringify(peerConnection.localDescription);
            await dbRef.child(`sessions/${sessionId}/offer`).set(offerSDP);
            addSignalingMessage("✅ Offer written to Firebase!", "received");

            dbRef.child(`sessions/${sessionId}/answer`).on("value", async (snapshot) => {
                const answerSDP = snapshot.val();
                if (answerSDP) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(answerSDP)));
                    addSignalingMessage("✅ Answer received from Firebase!", "received");
                }
            });
        }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
}


async function startCalleeFirebase(offerSDP) {
    peerConnection = new RTCPeerConnection(servers);

    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannelEvents(dataChannel);
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(offerSDP)));

    peerConnection.onicecandidate = async (event) => {
        if (event.candidate === null) {
            const answerSDP = JSON.stringify(peerConnection.localDescription);
            await dbRef.child(`sessions/${sessionId}/answer`).set(answerSDP);
            addSignalingMessage("✅ Answer written to Firebase!", "received");
        }
    };

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
}


// === Signaling Input Listener ===
signalingSendButton.addEventListener("click", () => {
    const input = signalingInput.value;
    signalingInput.value = "";

    addSignalingMessage(input, "sent");

    if (input.startsWith("firebase")) {
        const parts = input.split(" ");
        sessionId = parts[1] || prompt("Enter session ID:");
        useFirebase = true;
        addSignalingMessage(`🛰️ Firebase mode enabled with session ID: ${sessionId}`, "received");
        handleFirebaseMode();
        return;
    }

    // Manual fallback mode
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


// === Chat Message Send ===
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


// Enable “Send File” button
fileInput.addEventListener('change', () => {
    // fileInput.files is a FileList; we only allow one file for now
    if (fileInput.files.length > 0) {
      sendFileBtn.disabled = false;
    } else {
      sendFileBtn.disabled = true;
    }
  });


// On click, build and send the metadata object
sendFileBtn.addEventListener('click', () => {
    const file = fileInput.files[0];          // File API object
    const fileId = crypto.randomUUID();       // Unique transfer ID
  
    // Destructure the properties we need
    const { name: fileName, size: fileSize, type: mimeType } = file;
    const chunkSize   = 16 * 1024;            // e.g. 16 KiB for later chunking
    const totalChunks = Math.ceil(fileSize / chunkSize);
  
    // Build the metadata packet
    const metadata = {
      fileId,
      fileName,
      mimeType,
      fileSize,
      chunkSize,
      totalChunks
    };
  
    // Send it as JSON over your open DataChannel
    dataChannel.send(JSON.stringify(metadata));
  
    // Disable UI to prevent double‐sends until next selection
    sendFileBtn.disabled = true;
    fileInput.value = '';  // clear selection for next time
  });



