// DOM Elements
const signalingInput = document.getElementById("signaling-input");
const signalingSendButton = document.getElementById("signaling-send-button");
const signalingMessages = document.getElementById("signaling-messages");

// App State
let role = null; // "caller" or "callee"

// Helper to add message to signaling panel
function addSignalingMessage(message, type = "system") {
    const msgDiv = document.createElement('div');
    msgDiv.textContent = message;
    msgDiv.className = `message ${type}`;
    signalingMessages.appendChild(msgDiv);
    signalingMessages.scrollTop = signalingMessages.scrollHeight;
}

// Event Listener for signaling "Send" button
signalingSendButton.addEventListener("click", () => {
    const input = signalingInput.value.trim().toLowerCase();
    signalingInput.value = "";

    addSignalingMessage(`You: ${input}`, "sent");

    // Handle role assignment
    if (role === null) {
        if (input === "caller" || input === "callee") {
            role = input;
            addSignalingMessage(`✅ ${role.charAt(0).toUpperCase() + role.slice(1)} role assigned.`, "received");
            // We could now trigger the next step (create offer or wait for offer)
        } else {
            addSignalingMessage("❌ Invalid role. Please type 'caller' or 'callee'.", "received");
        }
    } else {
        addSignalingMessage(`Role already set as '${role}'.`, "received");
    }
});






