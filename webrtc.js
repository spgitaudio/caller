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

// 📡 Modify SDP to Force Opus & Dual Mono
function forceOpusSDP(sdp) {
    console.log("🔧 Modifying SDP for Opus and Dual Mono...");
    return sdp
        .replace(/a=rtpmap:\d+ opus\/\d+/g, "a=rtpmap:111 opus/48000") // Force Opus codec
        .replace(/a=fmtp:\d+ /g, "a=fmtp:111 stereo=1; sprop-stereo=1; ") // Force stereo Opus
        .replace(/a=sendrecv/g, "a=sendonly"); // Caller only sends media
}

// 📡 Creates SDP Offer when "Create Offer" Button is Clicked
// 📡 Caller: Create SDP Offer with Opus
async function createOffer() {
    let offer = await peerConnection.createOffer();
    offer.sdp = forceOpusSDP(offer.sdp); // Modify SDP before setting
    await peerConnection.setLocalDescription(offer);
    document.getElementById("offer").value = JSON.stringify(offer);
    console.log("📡 SDP Offer Created with Opus:", JSON.stringify(offer));
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