const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const statusSpan = document.getElementById('status');
const ctx = canvas.getContext('2d');

let model = null;
let isPersonInFrame = false;
let isPersonHorizontal = false;
let verticalAlertInterval = null;
let outOfFrameAlertInterval = null;
let audioContext = null;

async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            },
            audio: false
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        };
    } catch (err) {
        console.error("Error accessing camera: ", err);
        statusSpan.textContent = "Error accessing camera. Please grant permission.";
    }
}

async function loadModel() {
    statusSpan.textContent = "Loading model...";
    try {
        model = await cocoSsd.load();
        statusSpan.textContent = "Model loaded. Point the camera at the sleeping person.";
        detectFrame();
    } catch (err) {
        console.error("Error loading model: ", err);
        statusSpan.textContent = "Error loading the machine learning model.";
    }
}

function playBeep(frequency = 440, duration = 100) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.01);

    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = 'sine';
    oscillator.start(audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + duration / 1000);
    oscillator.stop(audioContext.currentTime + duration / 1000);
}

function startShortBeepAlert() {
    if (!verticalAlertInterval) {
        verticalAlertInterval = setInterval(() => playBeep(600, 150), 500);
    }
    stopContinuousBeepAlert();
}

function stopShortBeepAlert() {
    clearInterval(verticalAlertInterval);
    verticalAlertInterval = null;
}

function startContinuousBeepAlert() {
    if (!outOfFrameAlertInterval) {
        outOfFrameAlertInterval = setInterval(() => playBeep(800, 300), 400);
    }
    stopShortBeepAlert();
}

function stopContinuousBeepAlert() {
    clearInterval(outOfFrameAlertInterval);
    outOfFrameAlertInterval = null;
}

async function detectFrame() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const predictions = await model.detect(video);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const personPrediction = predictions.find(p => p.class === 'person' && p.score > 0.6);

        if (personPrediction) {
            if (!isPersonInFrame) {
                isPersonInFrame = true;
                stopContinuousBeepAlert();
            }
            const [x, y, width, height] = personPrediction.bbox;

            // Draw bounding box
            ctx.strokeStyle = 'lime';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);

            // Determine orientation
            const isCurrentlyHorizontal = width > height * 1.5;

            if (isCurrentlyHorizontal) {
                if (!isPersonHorizontal) {
                    isPersonHorizontal = true;
                    statusSpan.textContent = "Person detected: Sleeping";
                    stopShortBeepAlert();
                }
            } else {
                if (isPersonHorizontal) {
                    statusSpan.textContent = "Person detected: Waking up!";
                    startShortBeepAlert();
                } else {
                    statusSpan.textContent = "Person detected: Vertical";
                }
                isPersonHorizontal = false;
            }

        } else {
            if (isPersonInFrame) {
                isPersonInFrame = false;
                statusSpan.textContent = "Person has left the frame!";
                startContinuousBeepAlert();
            } else {
                 statusSpan.textContent = "No person detected.";
            }
            isPersonHorizontal = false;
            stopShortBeepAlert();
        }
    }
    requestAnimationFrame(detectFrame);
}

async function startApp() {
    await setupCamera();
    video.addEventListener('loadeddata', loadModel);
}

startApp();