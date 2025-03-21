// Application States
const APP_STATES = {
    HOME: 'home',
    WORKOUT_WAITING: 'workout_waiting', // With GIF overlay, before SPACE
    COUNTDOWN: 'countdown',
    TRACKING: 'tracking',
    RESULTS: 'results'
};

// DOM Elements
const homeScreen = document.getElementById('homeScreen');
const workoutScreen = document.getElementById('workoutScreen');
const resultsScreen = document.getElementById('resultsScreen');
const goalInput = document.getElementById('goalInput');
const startButton = document.getElementById('startButton');
const closeButton = document.getElementById('closeButton');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const gifOverlay = document.getElementById('gifOverlay');
const countdown = document.getElementById('countdown');
const startText = document.getElementById('startText');
const halfRepText = document.getElementById('halfRepText');
const goalText = document.getElementById('goalText');
const progressBar = document.getElementById('progressBar');
const resultsContent = document.getElementById('resultsContent');

// Canvas context
const ctx = canvas.getContext('2d');

// Application state
let currentState = APP_STATES.HOME;

// Pose detection variables
let detector;
let poses;
let isUp = true;
let isMid = false;
let downCount = 0;
let upCount = 0;
let midCount = 0;
let repCount = 0;
let percentage = 0;
let halfRep = false;
let halfRepPercent = 0;

// Angle thresholds - exactly as in original
const downAngle = 95;
const upAngle = 160;
let midAngle = 160;

// Countdown variables
let countdownValue = 3;
let countdownComplete = false;
let startCountdown = false;
let frames = 0;
let fps = 30;
let animationFrameId = null;

// Goal tracking
let goal = 10;
let origGoal = 10;

// Initialize the application
async function init() {
    // Set up event listeners
    startButton.addEventListener('click', startWorkout);
    closeButton.addEventListener('click', showHomeScreen);
    document.addEventListener('keydown', handleKeyPress);
    
    // Load the pose detection model
    await loadPoseDetectionModel();
    
    // Check if there are previous results
    await fetchResults();
    
    // Start in home state
    changeState(APP_STATES.HOME);
}

// Load the TensorFlow.js pose detection model
async function loadPoseDetectionModel() {
    try {
        const detectorConfig = {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
            enableSmoothing: true
        };
        detector = await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet, 
            detectorConfig
        );
        console.log('Pose detection model loaded');
    } catch (error) {
        console.error('Error loading pose detection model:', error);
    }
}

// Change application state
function changeState(newState) {
    currentState = newState;
    
    // Hide all screens
    homeScreen.classList.add('hidden');
    workoutScreen.classList.add('hidden');
    resultsScreen.classList.add('hidden');
    
    // Show screen based on state
    switch (newState) {
        case APP_STATES.HOME:
            homeScreen.classList.remove('hidden');
            break;
            
        case APP_STATES.WORKOUT_WAITING:
        case APP_STATES.COUNTDOWN:
        case APP_STATES.TRACKING:
            workoutScreen.classList.remove('hidden');
            
            // Show/hide GIF overlay based on state
            if (newState === APP_STATES.WORKOUT_WAITING) {
                gifOverlay.classList.remove('hidden');
            } else {
                gifOverlay.classList.add('hidden');
            }
            
            // Show/hide countdown based on state
            if (newState === APP_STATES.COUNTDOWN) {
                countdown.classList.remove('hidden');
            } else {
                countdown.classList.add('hidden');
            }
            break;
            
        case APP_STATES.RESULTS:
            resultsScreen.classList.remove('hidden');
            break;
    }
}

// Start the workout
function startWorkout() {
    goal = parseInt(goalInput.value) || 10;
    origGoal = goal;
    
    // Reset counters
    isUp = true;
    isMid = false;
    downCount = 0;
    upCount = 0;
    midCount = 0;
    repCount = 0;
    percentage = 0;
    halfRep = false;
    halfRepPercent = 0;
    
    // Reset countdown
    countdownValue = 3;
    countdownComplete = false;
    startCountdown = false;
    frames = 0;
    
    // Change to workout waiting state (with GIF overlay)
    changeState(APP_STATES.WORKOUT_WAITING);
    
    // Start camera
    startCamera();
}

// Start the camera
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: false
        });
        
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Start the animation loop
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            animationFrameId = requestAnimationFrame(detectPose);
        };
    } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Error accessing camera. Please make sure you have granted camera permissions.');
        changeState(APP_STATES.HOME);
    }
}

// Detect pose in video stream
async function detectPose() {
    if (!video.paused && !video.ended) {
        // Get poses from detector
        if (detector && video.readyState === 4) {
            try {
                poses = await detector.estimatePoses(video);
            } catch (error) {
                console.error('Error estimating poses:', error);
            }
        }
        
        // Clear canvas and draw video
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Process poses and draw skeleton
        if (poses && poses.length > 0) {
            drawSkeleton(poses[0]);
            
            // Only process pushups after countdown is complete
            if (currentState === APP_STATES.TRACKING) {
                processPushups(poses[0]);
            }
        }
        
        // Handle countdown if in countdown state
        if (currentState === APP_STATES.COUNTDOWN) {
            handleCountdown();
        }
        
        // Update UI based on current state
        updateUI();
        
        // Request next frame
        animationFrameId = requestAnimationFrame(detectPose);
    }
}

// Draw skeleton on canvas
function drawSkeleton(pose) {
    const keypoints = pose.keypoints;
    
    // Draw keypoints
    for (const keypoint of keypoints) {
        if (keypoint.score > 0.3) {
            ctx.beginPath();
            ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = 'aqua';
            ctx.fill();
        }
    }
    
    // Draw connections
    const connections = [
        ['nose', 'left_eye'], ['nose', 'right_eye'],
        ['left_eye', 'left_ear'], ['right_eye', 'right_ear'],
        ['nose', 'left_shoulder'], ['nose', 'right_shoulder'],
        ['left_shoulder', 'left_elbow'], ['right_shoulder', 'right_elbow'],
        ['left_elbow', 'left_wrist'], ['right_elbow', 'right_wrist'],
        ['left_shoulder', 'right_shoulder'],
        ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
        ['left_hip', 'right_hip'],
        ['left_hip', 'left_knee'], ['right_hip', 'right_knee'],
        ['left_knee', 'left_ankle'], ['right_knee', 'right_ankle']
    ];
    
    const keypointMap = {};
    keypoints.forEach(keypoint => {
        keypointMap[keypoint.name] = keypoint;
    });
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    
    for (const [p1, p2] of connections) {
        const keypoint1 = keypointMap[p1];
        const keypoint2 = keypointMap[p2];
        
        if (keypoint1 && keypoint2 && keypoint1.score > 0.3 && keypoint2.score > 0.3) {
            ctx.beginPath();
            ctx.moveTo(keypoint1.x, keypoint1.y);
            ctx.lineTo(keypoint2.x, keypoint2.y);
            ctx.stroke();
        }
    }
}

// Process pushups from pose data - exactly matching original logic
function processPushups(pose) {
    const keypoints = pose.keypoints;
    
    // Get coordinates for angle calculation
    const findKeypoint = (name) => keypoints.find(kp => kp.name === name);
    
    const leftShoulder = findKeypoint('left_shoulder');
    const leftElbow = findKeypoint('left_elbow');
    const leftWrist = findKeypoint('left_wrist');
    const rightShoulder = findKeypoint('right_shoulder');
    const rightElbow = findKeypoint('right_elbow');
    const rightWrist = findKeypoint('right_wrist');
    
    if (leftShoulder && leftElbow && leftWrist && 
        rightShoulder && rightElbow && rightWrist &&
        leftShoulder.score > 0.3 && leftElbow.score > 0.3 && leftWrist.score > 0.3 &&
        rightShoulder.score > 0.3 && rightElbow.score > 0.3 && rightWrist.score > 0.3) {
        
        // Calculate angles
        const leftAngle = findAngle(
            { x: leftShoulder.x, y: leftShoulder.y },
            { x: leftElbow.x, y: leftElbow.y },
            { x: leftWrist.x, y: leftWrist.y }
        );
        
        const rightAngle = findAngle(
            { x: rightShoulder.x, y: rightShoulder.y },
            { x: rightElbow.x, y: rightElbow.y },
            { x: rightWrist.x, y: rightWrist.y }
        );
        
        // Decide which arm angle to track - exactly as in original
        let testAngle;
        if (leftShoulder.z < rightShoulder.z) {
            testAngle = leftAngle;
        } else {
            testAngle = rightAngle;
        }
        
        // Convert angle to a 0-100% progress - exactly as in original
        percentage = (1 - (testAngle - downAngle) / (upAngle - downAngle)) * 100;
        percentage = Math.max(0, Math.min(100, percentage));
        
        // If arms go "down" enough - exactly as in original
        if (testAngle <= downAngle) {
            downCount += 1;
            if (downCount >= Math.floor(fps / 5)) {
                up_count = 0;
                isUp = false;
            }
        }
        
        // If arms go "up" enough - exactly as in original
        if (testAngle >= upAngle) {
            upCount += 1;
            if (upCount >= Math.floor(fps / 5)) {
                // Completed one rep
                if (!isUp) {
                    halfRep = false;
                    repCount += 1;
                    goal -= 1;
                    console.log(`Reps so far: ${repCount}`);
                }
                // If we are already "up" and pass through mid, show half-rep
                if (isMid && isUp) {
                    halfRepPercent = (1 - (midAngle - downAngle) / (upAngle - downAngle)) * 100;
                    halfRep = true;
                }
                
                isUp = true;
                downCount = 0;
                isMid = false;
                midCount = 0;
                midAngle = upAngle;
            }
        }
        
        // If arms are in between up/down - exactly as in original
        if (downAngle < testAngle && testAngle < upAngle) {
            midCount += 1;
            midAngle = Math.min(midAngle, testAngle);
            if (midCount >= Math.floor(fps / 5)) {
                isMid = true;
                upCount = 0;
            }
        }
    }
}

// Calculate angle between three points - exactly as in original
function findAngle(a, b, c) {
    const ba = { x: a.x - b.x, y: a.y - b.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };
    
    const dot = ba.x * bc.x + ba.y * bc.y;
    const abMag = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
    const bcMag = Math.sqrt(bc.x * bc.x + bc.y * bc.y);
    
    const cosAngle = dot / (abMag * bcMag);
    const angle = Math.acos(Math.min(Math.max(cosAngle, -1), 1));
    
    return angle * (180 / Math.PI);
}

// Handle countdown - exactly as in original
function handleCountdown() {
    countdown.textContent = countdownValue.toString();
    
    frames += 1;
    if (frames >= fps) {
        frames = 0;
        countdownValue -= 1;
        
        if (countdownValue < 1) {
            countdownComplete = true;
            countdown.classList.add('hidden');
            startText.classList.remove('hidden');
            
            // Change to tracking state
            changeState(APP_STATES.TRACKING);
            
            // Hide start text after 1 second (fps/2 frames)
            setTimeout(() => {
                startText.classList.add('hidden');
            }, 1000);
        }
    }
}

// Update UI elements based on current state
function updateUI() {
    // Update progress bar
    progressBar.style.width = `${percentage * 0.75}%`;
    
    // Update half-rep text
    if (halfRep) {
        halfRepText.textContent = `Half-rep: ${Math.round(halfRepPercent)}% there`;
        halfRepText.classList.remove('hidden');
    } else {
        halfRepText.classList.add('hidden');
    }
    
    // Update goal text
    if (currentState === APP_STATES.COUNTDOWN || currentState === APP_STATES.TRACKING) {
        goalText.textContent = goal > 0 ? `Pushups remaining: ${goal}` : `Goal completed! (+${-goal})`;
        goalText.classList.remove('hidden');
    } else {
        goalText.classList.add('hidden');
    }
}

// Handle key press events - exactly as in original
function handleKeyPress(event) {
    // Space key to start countdown - ONLY in WORKOUT_WAITING state
    if (event.code === 'Space' && currentState === APP_STATES.WORKOUT_WAITING) {
        startCountdown = true;
        changeState(APP_STATES.COUNTDOWN);
    }
    
    // Escape key to finish workout - ONLY in TRACKING state
    if (event.code === 'Escape' && currentState === APP_STATES.TRACKING) {
        finishWorkout();
    }
}

// Finish workout and show results
async function finishWorkout() {
    // Stop camera
    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
    
    // Cancel animation frame
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // Save results
    await saveResults();
    
    // Show results screen
    changeState(APP_STATES.RESULTS);
    
    // Display results
    displayResults();
}

// Save results to server - exactly as in original
async function saveResults() {
    try {
        const response = await fetch('/api/save-results', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reps: repCount,
                goal: origGoal
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save results');
        }
    } catch (error) {
        console.error('Error saving results:', error);
    }
}

// Fetch results from server
async function fetchResults() {
    try {
        const response = await fetch('/api/get-results');
        if (response.ok) {
            const data = await response.json();
            return data;
        }
    } catch (error) {
        console.error('Error fetching results:', error);
    }
    
    return [[]];
}

// Display results - exactly as in original
async function displayResults() {
    const data = await fetchResults();
    
    let results = 'N/A';
    let tGoal = 'N/A';
    
    if (data[0].length >= 2) {
        results = data[0][data[0].length - 2];
        tGoal = data[0][data[0].length - 1];
    }
    
    let message = '';
    try {
        const r = parseInt(results);
        const g = parseInt(tGoal);
        
        if (r <= 0.8 * g) {
            message = 'Not quite enough – keep working!';
        } else if (r >= 1.2 * g) {
            message = 'Nice! You exceeded your goal.';
        } else {
            message = 'Great job! You met your goal.';
        }
    } catch (error) {
        message = 'No valid numeric data found.';
    }
    
    resultsContent.innerHTML = `
        <p>Goal: ${tGoal} reps</p>
        <p>Results: ${results} reps</p>
        <p>${message}</p>
    `;
}

// Show home screen
function showHomeScreen() {
    changeState(APP_STATES.HOME);
}

// Initialize the application when the page loads
window.addEventListener('DOMContentLoaded', init);
