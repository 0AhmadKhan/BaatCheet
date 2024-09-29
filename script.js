const button = document.getElementById('send-button');
const messagesDiv = document.getElementById("chat-messages");
const colors = ['red', 'blue'];
let messages = [
                ["Hello! How are you?","remote"],
                ["Im good thanks wbu?","local"],
                ["Also good what you up to?","remote"],
                ["you know the usual","local"],
                ["Hello! How are you?","remote"],
                ["Im good thanks wbu?","local"],
                ["Also good what you up to?","remote"],
                ["you know the usual","local"],
                ["Hello! How are you?","remote"],
                ["Im good thanks wbu?","local"],
                ["Also good what you up to?","remote"],
                ["you know the usual","local"],
                ["Hello! How are you?","remote"],
                ["Im good thanks wbu?","local"],
                ["Also good what you up to?","remote"],
                ["you know the usual","local"],
                ["Hello! How are you?","remote"],
                ["Im good thanks wbu?","local"],
                ["Also good what you up to?","remote"],
                ["you know the usual","local"],
                ["Hello! How are you?","remote"],
                ["Im good thanks wbu?","local"],
                ["Also good what you up to?","remote"],
                ["you know the usual","local"],
                ["Hello! How are you?","remote"],
                ["Im good thanks wbu?","local"],
                ["Also good what you up to?","remote"],
                ["you know the usual","local"],
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

button.addEventListener('click', () => {
    if (button.style.backgroundColor === 'red') {
        button.style.backgroundColor = 'blue';
    } else {
        button.style.backgroundColor = 'red';
    }
});

window.onload = () => {
    var objDiv = document.getElementById("scrollable-div");
    objDiv.scrollTop = objDiv.scrollHeight;
}