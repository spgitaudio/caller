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

    console.log("🎧 Prepared stereo stream and starting playback...");

    // 🎧 5️⃣ Automatically start playing TTS Audio Locally
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
    console.log("📡 SDP Offer Created and streaming started:", JSON.stringify(offer));
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

    console.log("startWebRTC Channels:", stream.getAudioTracks()[0].getSettings().channelCount);

    // ✅ Only create an offer if there's no existing one
    if (!peerConnection.localDescription) {
        console.log("📡 Creating initial SDP offer...");
        createOffer();
    } else {
        console.log("✅ WebRTC already established. Streaming media...");
    }
}

function checkConnectionStatus() {
    if (!peerConnection) {
        console.log("❌ WebRTC connection is not initialized.");
        return;
    }

    console.log("🔄 Checking WebRTC Connection Status...");
    console.log("🔄 ICE Connection State:", peerConnection.iceConnectionState);
    console.log("🔄 Signaling State:", peerConnection.signalingState);
    console.log("🔄 Connection State:", peerConnection.connectionState);

    let senders = peerConnection.getSenders();
    let isStreaming = senders.some(sender => sender.track && sender.track.readyState === "live");

    senders.forEach(sender => {
        if (sender.track) {
            console.log(`🎤 Sender Track: ID=${sender.track.id}, ReadyState=${sender.track.readyState}, Muted=${sender.track.muted}`);
        }
    });

    if (isStreaming) {
        console.log("📡 ✅ Audio track is added, but is it actually streaming?");
        senders.forEach(sender => {
            if (sender.track) {
                console.log(`🔍 Track ID: ${sender.track.id}, Enabled: ${sender.track.enabled}, Muted: ${sender.track.muted}, ReadyState: ${sender.track.readyState}`);
            }
        });

        // ✅ Check if track is producing actual audio
        let audioTrack = senders.find(sender => sender.track && sender.track.kind === "audio");
        if (audioTrack && audioTrack.track.muted === false) {
            console.log("📡 ✅ Audio is ACTUALLY streaming from Client to Server!");
        } else {
            console.log("📡 ❌ Audio track exists but is not sending actual samples yet.");
        }
    } else {
        console.log("📡 ❌ No active audio stream detected from Client.");
    }
}

async function checkClientStats() {
    if (!peerConnection) return;

    let stats = await peerConnection.getStats();
    stats.forEach(report => {
        if (report.type === "outbound-rtp" && report.kind === "audio") {
            console.log(`📡 Client Sending Audio - Packets Sent: ${report.packetsSent}, Bitrate: ${report.bytesSent}`);
        }
    });

    for (const stat of stats.values()) {
      Object.keys(stat).forEach((statName) => {
        console.log(`${statName}: ${report[statName]}`);
      });
    }

    setTimeout(checkClientStats, 5000); // Check every 5 seconds
}

// ✅ Start checking client WebRTC statistics
setTimeout(checkClientStats, 5000);
