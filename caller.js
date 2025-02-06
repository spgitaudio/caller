console.clear();

// Request microphone access for recording & streaming
navigator.mediaDevices.getUserMedia({
    audio: { autoGainControl: false, channelCount: 2, echoCancellation: false, noiseSuppression: false, sampleRate: 48000 }
});

let dropdownFar = document.getElementById('far-filename-dropdown');
let buffer = null;
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let dest = audioContext.createMediaStreamDestination();

// Load and Decode .wav file
function loadFarFile() {
    let farFilename = dropdownFar.options[dropdownFar.selectedIndex].value;
    fetch(farFilename)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer, (data) => {
            buffer = data;
            document.getElementById("loaded_file").innerHTML = "Loaded: " + farFilename;
        }));
}

// Play .wav file through loudspeaker
function playFarFile() {
    if (!buffer) return console.warn("No file loaded!");
    let source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.connect(dest);  // Capture for WebRTC streaming
    source.start();
}

// Stop playback
function stopFarFile() {
    if (source) source.stop();
}

// 📡 Stream & Play (New Function)
async function startStreamingAndPlay() {
    console.log("📡 Streaming & Playing...");

    // 1️⃣ Get Mic Access
    let micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    let micSource = audioContext.createMediaStreamSource(micStream);

    // 2️⃣ Merge Mic + Rendered Audio into One Stream
    let merger = audioContext.createChannelMerger(2);
    
    let source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(merger, 0, 0); // Left = Render
    micSource.connect(merger, 0, 1); // Right = Mic
    
    let mixedStream = audioContext.createMediaStreamDestination();
    merger.connect(mixedStream);

    // 3️⃣ Start Playing Audio
    source.connect(audioContext.destination);
    source.start(audioContext.currentTime + 1.0); // 1-sec delay to ensure streaming starts first

    // 4️⃣ Start WebRTC Streaming
    startWebRTC(mixedStream.stream);
}

// Event Listeners
document.querySelector(".load").addEventListener("click", loadFarFile);
document.querySelector(".play").addEventListener("click", playFarFile);
document.querySelector(".stop-far").addEventListener("click", stopFarFile);
document.querySelector(".stream-and-play").addEventListener("click", startStreamingAndPlay);
