let peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
});

// Configure sender for mono 48kHz Opus
const audioConstraints = {
    audio: {
        sampleRate: 48000,
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
    }
};

navigator.mediaDevices.getUserMedia(audioConstraints).then(stream => {
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
    console.log("🎙 Caller configured to send mono Opus 48kHz");
}).catch(error => console.error("🎙 Error getting user media:", error));

peerConnection.onicecandidate = event => {
    if (event.candidate) {
        localStorage.setItem("iceCandidate", JSON.stringify(event.candidate));
    }
};

// 📡 Watch for SDP Answer from Receiver
window.addEventListener("storage", (event) => {
    if (event.key === "sdpAnswer" && event.newValue) {
        let answer = JSON.parse(event.newValue);
        peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("✅ SDP Answer Set!");
    }

    if (event.key === "iceCandidateReceiver" && event.newValue) {
        let candidate = JSON.parse(event.newValue);
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log("📡 ICE Candidate Added from Receiver.");
    }
});

// 📡 Modify SDP to Force Opus & Dual Mono
function forceOpusSDP(sdp) {
    console.log("🔧 Modifying SDP for Opus and Dual Mono...");
    return sdp
        .replace(/a=rtpmap:\d+ opus\/\d+/g, "a=rtpmap:111 opus/48000") // Force Opus codec
        .replace(/a=fmtp:\d+ /g, "a=fmtp:111 stereo=1; sprop-stereo=1; ") // Force stereo Opus
        .replace(/a=sendonly/g, "a=sendonly"); // Caller only sends media
}

// 📡 Create and Store SDP Offer
// The following version seemed to initially create a short offer which might have been incomplete
//async function createOffer() {
//    let offer = await peerConnection.createOffer();
//    offer.sdp = offer.sdp.replace(/a=sendrecv/g, "a=sendonly"); // Ensure send-only mode
//    await peerConnection.setLocalDescription(offer);
//    localStorage.setItem("sdpOffer", JSON.stringify(offer));
//    console.log("📡 SDP Offer Stored in localStorage.");
//}

// Try the following version and see if it creates a longer and complete offer
async function createOffer() {
    console.log("📡 Creating WebRTC offer...");

    let audioContext = new AudioContext();

    // 🎙 1️⃣ Capture Microphone Input (Mono)
    let micStream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 48000, channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    let micSource = audioContext.createMediaStreamSource(micStream);

    // 🎵 2️⃣ Load & Decode TTS Audio (WAV File)
    let ttsBufferSource = audioContext.createBufferSource();
    ttsBufferSource.buffer = buffer; // Assuming buffer contains the loaded TTS WAV file

    // 🎛 3️⃣ Create a Stereo Merger (Left = TTS, Right = Mic)
    let merger = audioContext.createChannelMerger(2);
    ttsBufferSource.connect(merger, 0, 0); // Left Channel: TTS
    micSource.connect(merger, 0, 1); // Right Channel: Mic

    // 🔄 4️⃣ Create Merged MediaStream
    let mixedStream = audioContext.createMediaStreamDestination();
    merger.connect(mixedStream);

    // 🎧 5️⃣ Play TTS Audio Locally
    ttsBufferSource.connect(audioContext.destination);
    ttsBufferSource.start(audioContext.currentTime + 1.0); // Delay to ensure mic capture starts first

    // 📡 6️⃣ Add the Stereo Stream to WebRTC
    mixedStream.stream.getTracks().forEach(track => peerConnection.addTrack(track, mixedStream.stream));

    // 📡 7️⃣ Create & Modify SDP Offer
    let offer = await peerConnection.createOffer();
    offer.sdp = forceOpusSDP(offer.sdp); // Ensure Opus codec + stereo settings
    await peerConnection.setLocalDescription(offer);

    // 📋 8️⃣ Display Offer for Manual Copy-Paste
    document.getElementById("offer").value = JSON.stringify(offer);
    console.log("📡 SDP Offer Created:", JSON.stringify(offer));
}

// Bind buttons for UI control
document.querySelector("#createOfferButton").addEventListener("click", createOffer);
