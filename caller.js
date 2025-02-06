// set up for downlink playback (fetch/load wav file from webserver, play locally over loudspeaker)
console.clear();

navigator.mediaDevices.getUserMedia({
  audio: {
    autoGainControl: false,
    channelCount: 2,
    echoCancellation: false,
    latency: 0,
    noiseSuppression: false,
    sampleRate: 48000,
    sampleSize: 16,
    volume: 1.0
  }
});

////////////////////////////
				
let dropdownFar = document.getElementById('far-filename-dropdown');
dropdownFar.length = 0;

let defaultFarOption = document.createElement('option');
defaultFarOption.text = 'Choose a wav';

dropdownFar.add(defaultFarOption);
dropdownFar.selectedIndex = 0;

// filename (on the server) that lists all the available wav files to be downloaded and played on the laptop/desktop/cellphone
const url = 'list_of_wav_filenames.json';

// use fetch to retrieve the list of wav filenames and then populate the dropdown list
// report any errors that occur in the fetch operation
// 
fetch(url)
	.then(
		function (response) {
			if (response.status !== 200) {
				console.warn('Looks like there was a problem. Status Code: ' + response.status);
				return;
			}

			// Examine the text in the response and populate the dropdown with the filenames
			response.json().then(function (data) {
				let option;

				for (let i = 0; i < data.length; i++) {
					option = document.createElement('option');
					option.text = data[i].name;
					option.value = data[i].name;
					dropdownFar.add(option);
				}
			});
		}
	)
	.catch(function (err) {
		console.error('Fetch Error -', err);
	});


const loadFarButton = document.querySelector('.load');
const playFarButton = document.querySelector('.play');
const stopFarButton = document.querySelector('.stop-far');
// for cross browser -- see https://codepen.io/Rumyra/pen/qyMzqN/
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtxDownlink = new AudioContext();
let buffer = null;

//add events to the buttons
loadFarButton.addEventListener("click", loadFarFile);
playFarButton.addEventListener("click", playFarFile);
stopFarButton.addEventListener("click", stopFarFile);

let farFilename = ''

/*
  Disable the play and stopfar buttons until we successfully fetch the selected file 
*/
loadFarButton.disabled = false;
playFarButton.disabled = true;
stopFarButton.disabled = true;

function loadFarFile() {
	console.log("loadFarButton clicked");
	farFilename = dropdownFar.options[dropdownFar.selectedIndex].value;
	console.log("selected " + farFilename);

	fetch(farFilename)
		.then(function (response) {
			if (response.status !== 200) {
				console.warn('loadFarFile has a problem. Status Code: ' + response.status);
				console.warn('loadFarFile could not load ', farFilename);
				return;
			}
			return response.arrayBuffer()
		}).
		then(function (arrayBuffer) {
			if (arrayBuffer) {
				let undecodedAudio = arrayBuffer;
				audioCtxDownlink.decodeAudioData(undecodedAudio, (data) => buffer = data);

				// update the displayed loaded file
				document.getElementById("loaded_file").innerHTML = "Loaded: " + farFilename

				// enable the buttons now that we have successfully downloaded a file
				playFarButton.disabled = false;
				stopFarButton.disabled = false;
			}
		})
		.catch(function (err) {
			console.error('loadFarFile Error - ', err);
		});
}

var sourceFar = null;
const playFarAudio = document.getElementById('farAudioFile');
var dest = audioCtxDownlink.createMediaStreamDestination();

function playFarFile() {
	console.log("playFarButton clicked");
	sourceFar = audioCtxDownlink.createBufferSource();
	sourceFar.buffer = buffer;
	//sourceFar.connect(audioCtxDownlink.destination);
	sourceFar.connect(dest);
	sourceFar.start();
	playFarAudio.srcObject = dest.stream;
	playFarAudio.play();
}


function stopFarFile() {
	console.log("stopFarButton clicked");
	sourceFar.stop();
}


//////////////////////////////////////////////////////////////////////////////////////////
// set up for local recording
const recordButton = document.querySelector('.record');
const stopButton = document.querySelector('.stop');
const recordAndPlayButton = document.querySelector('.record_and_play');
const streamAndPlayButton = document.querySelector('.stream-and-play');
const soundClips = document.querySelector('.sound-clips');
const canvas = document.querySelector('.visualizer');
const mainSection = document.querySelector('.main-controls');


// visualiser setup - create web audio api context and canvas
const canvasCtx = canvas.getContext("2d");

//webkitURL is deprecated but nevertheless
URL = window.URL || window.webkitURL;

var gumStream; 						//stream from getUserMedia()
var rec; 							//Recorder.js object
var input; 							//MediaStreamAudioSourceNode we'll be recording

// shim for AudioContext when it's not avb. 
//var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext //audio context to help us record

//var recordButton = document.getElementById("recordButton");
//var stopButton = document.getElementById("stopButton");
//var pauseButton = document.getElementById("pauseButton");

//add events to the near side buttons
recordButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);
recordAndPlayButton.addEventListener("click", startRecordingAndPlay);
streamAndPlayButton.addEventListener("click", startStreamingAndPlay);
//pauseButton.addEventListener("click", pauseRecording);

function startRecording() {
	console.log("recordButton clicked");

	/*
		Simple constraints object, for more advanced audio features see
		https://addpipe.com/blog/audio-constraints-getusermedia/
	*/

	//var constraints = { audio: true, video: false }
	var constraints = {
		audio: {
			sampleRate: 48000,
			channelCount: 2,
			volume: 1.0,
			echoCancellation: false,
			noiseSuppression: false,
			autoGainControl: false
		},
		video: false
	}

	/*
	  Disable the record button until we get a success or fail from getUserMedia() 
	*/

	recordButton.disabled = true;
	stopButton.disabled = false;
	//pauseButton.disabled = false

	/*
		We're using the standard promise based getUserMedia() 
		https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
	*/

	navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
		console.log("getUserMedia() success, stream created, initializing Recorder.js ...");

		/*
			create an audio context after getUserMedia is called
			sampleRate might change after getUserMedia is called, like it does on macOS when recording through AirPods
			the sampleRate defaults to the one set in your OS for your playback device

		*/
		audioContext = new AudioContext();

		//update the format 
		document.getElementById("formats").innerHTML = "Format: 1 channel pcm @ " + audioContext.sampleRate / 1000 + "kHz"

		/*  assign to gumStream for later use  */
		gumStream = stream;

		/* use the stream */
		input = audioContext.createMediaStreamSource(stream);

		/* 
			Create the Recorder object and configure to record mono sound (1 channel)
			Recording 2 channels  will double the file size
		*/
		rec = new Recorder(input, { numChannels: 1 })

		visualize(stream);

		//start the recording process
		rec.record()

		console.log("Recording started");

	}).catch(function (err) {
		//enable the record button if getUserMedia() fails
		recordButton.disabled = false;
		stopButton.disabled = true;
		//pauseButton.disabled = true
	});
}

function startRecordingAndPlay() {
	console.log("recordAndPlayButton clicked");
	startRecording();

	sourceFar = audioCtxDownlink.createBufferSource();
	sourceFar.buffer = buffer;
	//source.connect(audioCtxDownlink.destination);
	sourceFar.connect(dest);
	playFarAudio.srcObject = dest.stream;
	playFarAudio.play();
	// Start playback 1 second after the current time so that we're confident that recording has started
	// and reduces the chance that we miss the first portion of the far file
	sourceFar.start(audioCtxDownlink.currentTime + 1.0);
}

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

function pauseRecording() {
	console.log("pauseButton clicked rec.recording=", rec.recording);
	if (rec.recording) {
		//pause
		rec.stop();
		//pauseButton.innerHTML = "Resume";
	} else {
		//resume
		rec.record()
		//pauseButton.innerHTML = "Pause";

	}
}

function stopRecording() {
	console.log("stopButton clicked");

	//disable the stop button, enable the record too allow for new recordings
	stopButton.disabled = true;
	recordButton.disabled = false;
	//pauseButton.disabled = true;

	//reset button just in case the recording is stopped while paused
	//pauseButton.innerHTML = "Pause";

	//tell the recorder to stop the recording
	rec.stop();

	//stop microphone access
	gumStream.getAudioTracks()[0].stop();

	//create the wav blob and pass it on to createDownloadLink
	rec.exportWAV(createDownloadLink);
}

function createDownloadLink(blob) {

	var url = URL.createObjectURL(blob);
	var au = document.createElement('audio');
	var li = document.createElement('li');
	var link = document.createElement('a');

	//name of .wav file to use during upload and download (without extendion)
	var filename = new Date().toISOString();

	//add controls to the <audio> element
	au.controls = true;
	au.src = url;

	//save to disk link
	link.href = url;
	//link.download = filename + ".wav"; //download forces the browser to donwload the file using the  filename

	// append the name of the file that was played over the loudspeaker so that we can easily pair with the reference
	recordedFilename = filename + "." + farFilename.substr(0, farFilename.lastIndexOf(".")) + ".wav";
	link.download = recordedFilename; //download forces the browser to donwload the file using the recordedFilename
	link.innerHTML = "Save to disk";

	//add the new audio element to li
	li.appendChild(au);

	//add the filename to the li
	//li.appendChild(document.createTextNode(filename + ".wav "))
	li.appendChild(document.createTextNode(recordedFilename))

	//add the save to disk link to li
	li.appendChild(link);

	////upload link
	//var upload = document.createElement('a');
	//upload.href = "#";
	//upload.innerHTML = "Upload";
	//upload.addEventListener("click", function (event) {
	//	var xhr = new XMLHttpRequest();
	//	xhr.onload = function (e) {
	//		if (this.readyState === 4) {
	//			console.log("Server returned: ", e.target.responseText);
	//		}
	//	};
	//	var fd = new FormData();
	//	fd.append("audio_data", blob, filename);
	//	xhr.open("POST", "upload.php", true);
	//	xhr.send(fd);
	//})
	//li.appendChild(document.createTextNode(" "))//add a space in between
	//li.appendChild(upload)//add the upload link to li

	const deleteButton = document.createElement('button');
	deleteButton.textContent = 'Delete';
	deleteButton.className = 'delete';
	li.appendChild(deleteButton);

	//add the li element to the ol
	recordingsList.appendChild(li);


    deleteButton.onclick = function(e) {
    let evtTgt = e.target;
    evtTgt.parentNode.parentNode.removeChild(evtTgt.parentNode);
    }
}


//////////////////////////////////////////////////////////////////////////
// code to select the output device(s) that play the far file and also near file
// NOTE that a cellphone likely only has a single output device (single D/A converter)
// and likely will not offer anything that can be selected. Even though cellphones
// can play over their built-in loudspeaker(s) OR headphones, they typically cannot
// simultaneously play over both (and even less likely play different files over both)

'use strict';

const gumAudio = document.querySelector('audio.gum');
//gumAudio.addEventListener('play', () => {
//	gumAudio.volume = 0.1;
//	console.log('Audio lowered to reduce feedback from local gUM stream');
//});
//const gumVideo = document.querySelector('video.gum');
//gumVideo.addEventListener('play', () => {
//	gumVideo.volume = 0.1;
//	console.log('Audio lowered to reduce feedback from local gUM stream');
//});

function gotDevices(deviceInfos) {
	const masterOutputSelector = document.createElement('select');

	for (let i = 0; i !== deviceInfos.length; ++i) {
		const deviceInfo = deviceInfos[i];
		const option = document.createElement('option');
		option.value = deviceInfo.deviceId;
		if (deviceInfo.kind === 'audiooutput') {
			console.info('Found audio output device: ', deviceInfo.label);
			option.text = deviceInfo.label || `speaker ${masterOutputSelector.length + 1}`;
			masterOutputSelector.appendChild(option);
		} else {
			console.log('Found non audio output device: ', deviceInfo.label);
		}
	}

	// Clone the master outputSelector and replace outputSelector placeholders.
	//const allOutputSelectors = document.querySelectorAll('select');
	const allOutputSelectors = document.querySelectorAll('div.outputSelector select');
	for (let selector = 0; selector < allOutputSelectors.length; selector++) {
		const newOutputSelector = masterOutputSelector.cloneNode(true);
		newOutputSelector.addEventListener('change', changeAudioDestination);
		allOutputSelectors[selector].parentNode.replaceChild(newOutputSelector, allOutputSelectors[selector]);
	}
}

navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);

// Attach audio output device to the provided media element using the deviceId.
function attachSinkId(element, sinkId, outputSelector) {
	if (typeof element.sinkId !== 'undefined') {
		element.setSinkId(sinkId)
			.then(() => {
				console.log(`Success, audio output device attached: ${sinkId} to element with ${element.title} as source.`);
			})
			.catch(error => {
				let errorMessage = error;
				if (error.name === 'SecurityError') {
					errorMessage = `You need to use HTTPS for selecting audio output device: ${error}`;
				}
				console.error(errorMessage);
				// Jump back to first output device in the list as it's the default.
				outputSelector.selectedIndex = 0;
			});
	} else {
		console.warn('Browser does not support output device selection.');
	}
}

function changeAudioDestination(event) {
	const deviceId = event.target.value;
	const outputSelector = event.target;
	// FIXME: Make the media element lookup dynamic.
	const element = event.path[2].childNodes[1];
	attachSinkId(element, deviceId, outputSelector);
}

function gotStream(stream) {
	window.stream = stream; // make stream available to console
	//window.stream = audioCtxDownlink.stream		// @todo shree, absolutely NO idea if this is a reasonable (or meaningless) hack
	gumAudio.srcObject = stream;
	//gumVideo.srcObject = stream;
}

function start() {
	// window.stream = audioCtxDownlink.stream		// @todo shree, absolutely NO idea if this is a reasonable (or meaningless) hack
	if (window.stream) {
		window.stream.getTracks().forEach(track => {
			track.stop();
		});
	}
	const constraints = {
		audio: true,
		video: false
	};
	navigator.mediaDevices.getUserMedia(constraints).then(gotStream).catch(handleError);
}

start();

function handleError(error) {
	console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
}


//////////////////////////////////////////////////////////////////////////
// code for visualizing the near side captured mic signal

function visualize(stream) {
  if(!audioContext) {
	  audioContext = new AudioContext();
  }

  const source = audioContext.createMediaStreamSource(stream);

  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  source.connect(analyser);
  //analyser.connect(audioCtx.destination);

  draw()

  function draw() {
    const WIDTH = canvas.width
    const HEIGHT = canvas.height;

    requestAnimationFrame(draw);

    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = 'rgb(200, 200, 200)';
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

    canvasCtx.beginPath();

    let sliceWidth = WIDTH * 1.0 / bufferLength;
    let x = 0;


    for(let i = 0; i < bufferLength; i++) {

      let v = dataArray[i] / 128.0;
      let y = v * HEIGHT/2;

      if(i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height/2);
    canvasCtx.stroke();

  }
}

window.onresize = function() {
  canvas.width = mainSection.offsetWidth;
}

window.onresize();