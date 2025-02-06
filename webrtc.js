let peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
});

peerConnection.onicecandidate = event => {
    if (event.candidate) {
        console.log("📡 ICE Candidate:", event.candidate.candidate);
    }
};

// 🎧 Detect when Streaming Starts
peerConnection.oniceconnectionstatechange = () => {
    console.log("🔄 ICE Connection State:", peerConnection.iceConnectionState);
    if (peerConnection.iceConnectionState === "connected") {
        console.log("✅ Streaming has started! WebRTC connection established.");
    }
};

// 🎙 Detect when Stream is Successfully Sent
peerConnection.onnegotiationneeded = async () => {
    console.log("🔄 Negotiation needed. Updating SDP...");
};

// 📡 Creates SDP Offer when "Create Offer" Button is Clicked
async function createOffer() {
    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    document.getElementById("offer").value = JSON.stringify(offer);
    console.log("📡 SDP Offer Created:", JSON.stringify(offer));
}

// 📥 Accepts Receiver's Answer (Pasted from Receiver)
async function setAnswer() {
    let answer = JSON.parse(document.getElementById("answer").value);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log("✅ SDP Answer Set!");
}

// 📡 Start WebRTC & Add Stream
function startWebRTC(stream) {
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

    // ✅ Only create an offer if there's no existing one
    if (!peerConnection.localDescription) {
        console.log("📡 Creating initial SDP offer...");
        createOffer();
    } else {
        console.log("✅ WebRTC already established. Streaming media...");
    }
}