const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const statusSpan = document.getElementById('status');
const statusContainer = document.getElementById('status-container');
const statusIcon = document.getElementById('status-icon');
const videoContainer = document.getElementById('video-container');
const loader = document.getElementById('loader');
const ctx = canvas.getContext('2d');

let model = null;
let isPersonInFrame = false;
let isPersonHorizontal = true;
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
 updateStatus("Error accessing camera. Please grant permission.", "missing");
 }
}

async function loadModel() {
 loader.style.display = 'block';
 updateStatus("Loading model...", "initializing");
 try {
 model = await cocoSsd.load();
 loader.style.display = 'none';
 updateStatus("Monitoring...", "monitoring");
 detectFrame();
 } catch (err) {
 console.error("Error loading model: ", err);
 updateStatus("Error loading model.", "missing");
 loader.style.display = 'none';
 }
}
function playBeep(frequency = 440, duration = 100, type = 'sine') {
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
 oscillator.type = type;
 oscillator.start(audioContext.currentTime);
 gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + duration / 1000);
 oscillator.stop(audioContext.currentTime + duration / 1000);
}

function startShortBeepAlert() {
 if (!verticalAlertInterval) {
 verticalAlertInterval = setInterval(() => playBeep(600, 150, 'square'), 500);
 }
 stopContinuousBeepAlert();
}
function stopShortBeepAlert() {
 clearInterval(verticalAlertInterval);
 verticalAlertInterval = null;
}

function startContinuousBeepAlert() {
 if (!outOfFrameAlertInterval) {
 outOfFrameAlertInterval = setInterval(() => playBeep(800, 300, 'sawtooth'), 400);
 }
 stopShortBeepAlert();
}

function stopContinuousBeepAlert() {
 clearInterval(outOfFrameAlertInterval);
 outOfFrameAlertInterval = null;
}

function updateStatus(message, statusClass) {
 statusSpan.textContent = message;
 statusContainer.className = `status-${statusClass}`;
 videoContainer.className = statusClass.includes('alert') ? `alert-${statusClass}` : '';
 switch(statusClass) {
 case 'monitoring':
 statusIcon.className = 'fas fa-bed';
 statusIcon.style.transform = 'rotate(0deg)';
 break;
 case 'vertical':
 statusIcon.className = 'fas fa-exclamation-triangle';
 statusIcon.style.transform = 'scale(1.2)';
 break;
 case 'missing':
 statusIcon.className = 'fas fa-question-circle';
 statusIcon.style.transform = 'scale(1.2)';
 break;
 default:
 statusIcon.className = 'fas fa-spinner fa-spin';
 break;
 }
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
 ctx.strokeStyle = '#2ecc71';
 ctx.lineWidth = 4;
 ctx.strokeRect(x, y, width, height);
 ctx.font = '18px Roboto';
 ctx.fillStyle = '#2ecc71';
 ctx.fillText('Person', x, y > 10 ? y - 5 : 15);

 const isCurrentlyHorizontal = width > height * 1.5;

 if (isCurrentlyHorizontal) {
 if (!isPersonHorizontal) {
 isPersonHorizontal = true;
 updateStatus("Person is Sleeping", "monitoring");
 stopShortBeepAlert();
 }
 } else {
 if (isPersonHorizontal) {
 updateStatus("Person is Waking Up!", "vertical");
 startShortBeepAlert();
 } else if (!verticalAlertInterval){
  updateStatus("Person is Vertical", "monitoring");
 }
 isPersonHorizontal = false;
 }

 } else {
 if (isPersonInFrame) {
 isPersonInFrame = false;
 updateStatus("Person is Missing!", "missing");
 startContinuousBeepAlert();
 } else if(!outOfFrameAlertInterval) {
 updateStatus("No person detected.", "monitoring");
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
