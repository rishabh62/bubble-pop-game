// Game constants
const BUBBLE_MIN_RADIUS = 20;
const BUBBLE_MAX_RADIUS = 50;
const BUBBLE_MIN_SPEED = 1;
const BUBBLE_MAX_SPEED = 4;
const OBSTACLE_WIDTH = 60;
const OBSTACLE_HEIGHT = 20;
const OBSTACLE_SPEED = 5;
const STAR_RADIUS = 15;
const STAR_SPEED = 3;
const GAME_DURATION = 60; // seconds
const BUBBLE_SPAWN_INTERVAL = 800; // milliseconds
const OBSTACLE_SPAWN_INTERVAL = 2000; // milliseconds
const STAR_SPAWN_INTERVAL = 3000; // milliseconds
const PLAYER_SIZE = 60;
const PLAYER_COLOR = '#ff416c';
const MAX_LEVEL = 5;
const PLAYER_SPEED_MULTIPLIER = 1.0; // Base value for touch sensitivity

// Game variables
let canvas, ctx;
let gameActive = false;
let score = 0;
let timeLeft = GAME_DURATION;
let bubbles = [];
let obstacles = [];
let stars = [];
let player = {
    x: 0,
    y: 0,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    vx: 0,
    vy: 0
};
let level = 1;
let bubbleSpawnInterval, obstacleSpawnInterval, starSpawnInterval, gameTimer;
let lastFrameTime = 0;
let touchStartX = 0;
let touchStartY = 0;
let isSwiping = false;
let highScore = 0;
let playerSensitivity = 1.0; // User-adjustable sensitivity multiplier
let playerControlTouchId = null; // Store touch ID for player movement

// DOM elements
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const endScreen = document.getElementById('end-screen');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const scoreElement = document.getElementById('score');
const timeElement = document.getElementById('time');
const finalScoreElement = document.getElementById('final-score');

// Try to get high score from local storage
try {
    const savedHighScore = localStorage.getItem('bubblePopHighScore');
    if (savedHighScore) {
        highScore = parseInt(savedHighScore, 10);
    }
} catch (e) {
    console.log('LocalStorage not available');
}

// Try to load saved sensitivity settings
try {
    const savedSensitivity = localStorage.getItem('playerSensitivity');
    if (savedSensitivity) {
        playerSensitivity = parseFloat(savedSensitivity);
    }
} catch (e) {
    console.log('LocalStorage not available for sensitivity settings');
}

// Haptic feedback function (if available)
function vibrate(pattern) {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
}

// Calculate viewport height for mobile browsers
function setMobileViewportHeight() {
    // First get the viewport height and multiply it by 1% to get a value for a vh unit
    const vh = window.innerHeight * 0.01;
    // Then set the value in the --vh custom property to the root of the document
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    console.log(`Set viewport height: ${vh * 100}px`);
}

// Initialize the game
function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    console.log("Initializing game...");

    // Explicitly check if all screen elements exist and log if they don't
    if (!startScreen) {
        console.error("Start screen not found!");
    }
    if (!gameScreen) {
        console.error("Game screen not found!");
    }
    if (!endScreen) {
        console.error("End screen not found!");
    }

    // Make sure all screens have correct display setting
    if (startScreen) {
        startScreen.style.display = 'flex';
        startScreen.classList.remove('hidden');
    }
    if (gameScreen) {
        gameScreen.style.display = 'none';
        gameScreen.classList.add('hidden');
    }
    if (endScreen) {
        endScreen.style.display = 'none';
        endScreen.classList.add('hidden');
    }

    // Set canvas size to match its container
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize settings
    initSettings();

    // Attach click handlers directly to buttons
    if (startButton) {
        console.log("Adding start button handler");
        startButton.onclick = function(e) {
            console.log("Start button clicked");
            e.preventDefault();

            // Make sure canvas is ready before starting
            if (!canvas || canvas.width === 0) {
                resizeCanvas();
            }

            startGame();
            vibrate(50);
        };
    } else {
        console.error("Start button not found!");
    }

    if (restartButton) {
        console.log("Adding restart button handler");
        restartButton.onclick = function(e) {
            console.log("Restart button clicked");
            e.preventDefault();

            // Make sure canvas is ready before restarting
            if (!canvas || canvas.width === 0) {
                resizeCanvas();
            }

            // Explicitly hide the end screen
            endScreen.style.display = 'none';
            endScreen.classList.add('hidden');

            startGame();
            vibrate(50);

            // Check that screens are in correct state after restart
            console.log(`After restart - Start: ${startScreen.style.display}, Game: ${gameScreen.style.display}, End: ${endScreen.style.display}`);
        };
    } else {
        console.error("Restart button not found!");
    }

    // Touch events with proper multi-touch support
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchCancel, { passive: false });

    // Add event listener for orientation changes
    window.addEventListener('orientationchange', () => {
        console.log('Orientation changed');

        // Wait for the orientation change to complete, then update everything
        setTimeout(() => {
            // Re-calculate viewport height
            setMobileViewportHeight();

            // Resize canvas
            resizeCanvas();

            // Ensure player is in correct position
            resetPlayerPosition();

            // Force redraw
            if (gameActive) {
                drawGame(16.67);
            }

            console.log('Orientation change processing complete');
        }, 500); // Longer timeout to ensure orientation has fully changed
    });

    // Set initial player position
    resetPlayerPosition();

    // Update UI with high score if available
    updateHighScoreUI();

    // Debug output to console
    console.log("Game initialized");
    console.log(`Canvas size: ${canvas.width}x${canvas.height}`);
}

// Initialize settings panel
function initSettings() {
    const settingsButton = document.getElementById('settings-button');
    const settingsButtonEnd = document.getElementById('settings-button-end');
    const settingsOverlay = document.getElementById('settings-overlay');
    const settingsClose = document.getElementById('settings-close');
    const sensitivitySlider = document.getElementById('sensitivity-slider');
    const sensitivityValue = document.getElementById('sensitivity-value');

    // Set initial slider value
    if (sensitivitySlider && sensitivityValue) {
        sensitivitySlider.value = playerSensitivity;
        sensitivityValue.textContent = playerSensitivity.toFixed(1);

        // Update value display when slider changes
        sensitivitySlider.addEventListener('input', function() {
            const newValue = parseFloat(this.value);
            sensitivityValue.textContent = newValue.toFixed(1);
        });
    }

    // Open settings from start screen
    if (settingsButton) {
        settingsButton.addEventListener('click', function(e) {
            e.preventDefault();
            if (settingsOverlay) {
                settingsOverlay.style.display = 'flex';
            }
        });
    }

    // Open settings from end screen
    if (settingsButtonEnd) {
        settingsButtonEnd.addEventListener('click', function(e) {
            e.preventDefault();
            if (settingsOverlay) {
                settingsOverlay.style.display = 'flex';
            }
        });
    }

    // Save settings and close overlay
    if (settingsClose) {
        settingsClose.addEventListener('click', function(e) {
            e.preventDefault();

            // Save sensitivity setting
            if (sensitivitySlider) {
                playerSensitivity = parseFloat(sensitivitySlider.value);

                // Save to localStorage
                try {
                    localStorage.setItem('playerSensitivity', playerSensitivity.toString());
                } catch (e) {
                    console.log('LocalStorage not available');
                }

                console.log(`Sensitivity set to: ${playerSensitivity}`);
            }

            // Hide settings overlay
            if (settingsOverlay) {
                settingsOverlay.style.display = 'none';
            }

            // Vibrate for feedback
            vibrate(30);
        });
    }
}

// Update high score UI
function updateHighScoreUI() {
    // Add high score display to end screen if it exists
    const highScoreElement = document.getElementById('high-score');
    if (highScoreElement) {
        highScoreElement.textContent = highScore;
    }
}

// Resize canvas to fit the screen
function resizeCanvas() {
    const container = canvas.parentElement;

    if (!container) {
        console.error("Canvas container not found");
        return;
    }

    // Force container dimensions to be properly calculated
    const containerWidth = container.clientWidth || window.innerWidth;
    const containerHeight = container.clientHeight || window.innerHeight;

    // Calculate safe area insets if they exist
    const safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top') || '0', 10);
    const safeAreaBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom') || '0', 10);

    // Log dimensions and safe areas
    console.log(`Container dimensions: ${containerWidth}x${containerHeight}`);
    console.log(`Safe areas - Top: ${safeAreaTop}px, Bottom: ${safeAreaBottom}px`);

    // Set canvas dimensions
    canvas.width = containerWidth;
    canvas.height = containerHeight;

    console.log(`Canvas resized to: ${canvas.width}x${canvas.height}`);

    // Reset player position when canvas is resized
    if (player) {
        resetPlayerPosition();
    }

    // Redraw game if active
    if (gameActive) {
        drawGame(16.67); // Pass a default frame time of 16.67ms (60fps)
    }
}

// Reset player position to bottom center of the screen
function resetPlayerPosition() {
    // Calculate safe area for mobile devices
    const safeAreaBottom = 80; // Increased padding to ensure visibility above nav bars and create more space

    player.x = canvas.width / 2 - player.width / 2;
    // Position player above the bottom edge with safe margin
    player.y = canvas.height - player.height - safeAreaBottom;
    player.vx = 0;
    player.vy = 0;

    console.log(`Player positioned at y: ${player.y}, canvas height: ${canvas.height}`);
}

// Switch screens with simple approach
function switchScreens(fromScreen, toScreen) {
    if (!fromScreen || !toScreen) {
        console.error("Invalid screens for switching");
        return;
    }

    console.log(`Switching from ${fromScreen.id} to ${toScreen.id}`);

    // Simple direct display changes - no transitions
    fromScreen.style.display = 'none';
    toScreen.style.display = 'flex';

    // Explicitly add and remove hidden classes to ensure proper state
    fromScreen.classList.add('hidden');
    toScreen.classList.remove('hidden');
}

// Complete reset of game state
function resetGame() {
    // Clear all game objects
    bubbles = [];
    obstacles = [];
    stars = [];

    // Reset game state
    score = 0;
    timeLeft = GAME_DURATION;
    level = 1;
    gameActive = false;

    // Clear any existing timers
    clearAllIntervals();

    // Reset player
    resetPlayerPosition();

    // Update UI elements
    scoreElement.textContent = "0";
    timeElement.textContent = GAME_DURATION.toString();

    // Reset screens
    startScreen.style.display = 'flex';
    startScreen.classList.remove('hidden');

    gameScreen.style.display = 'none';
    gameScreen.classList.add('hidden');

    endScreen.style.display = 'none';
    endScreen.classList.add('hidden');

    // Remove any temporary elements
    const levelIndicator = document.querySelector('.level-up-indicator');
    if (levelIndicator) {
        levelIndicator.parentNode.removeChild(levelIndicator);
    }

    const scorePopups = document.querySelectorAll('.score-popup');
    scorePopups.forEach(popup => {
        popup.parentNode.removeChild(popup);
    });

    const touchIndicators = document.querySelectorAll('.touch-indicator');
    touchIndicators.forEach(indicator => {
        indicator.parentNode.removeChild(indicator);
    });

    // Reset the canvas
    if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    console.log("Game state completely reset");
}

// Start the game
function startGame() {
    console.log("Start game function called");

    // Completely reset game state first
    resetGame();

    // Set new game state
    gameActive = true;

    // Update UI
    scoreElement.textContent = "0";
    timeElement.textContent = GAME_DURATION.toString();

    // Check if we're coming from the end screen or start screen
    const fromScreen = endScreen.style.display !== 'none' ? endScreen : startScreen;

    // Switch screens - ensure we're always coming from the correct screen
    switchScreens(fromScreen, gameScreen);

    // Make canvas active
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    console.log(`Canvas size: ${canvas.width}x${canvas.height}`);

    // Reset player position
    resetPlayerPosition();

    // Start game loops
    startGameLoops();

    // Start the game loop
    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);

    console.log("Game started - active:", gameActive);
}

// Start game timers and spawn intervals
function startGameLoops() {
    // Clear any existing intervals
    clearAllIntervals();

    // Spawn initial bubbles immediately
    for (let i = 0; i < 5; i++) {
        spawnBubble();
    }

    // Start spawn intervals
    bubbleSpawnInterval = setInterval(spawnBubble, BUBBLE_SPAWN_INTERVAL);
    obstacleSpawnInterval = setInterval(spawnObstacle, OBSTACLE_SPAWN_INTERVAL);
    starSpawnInterval = setInterval(spawnStar, STAR_SPAWN_INTERVAL);

    // Start game timer
    gameTimer = setInterval(() => {
        timeLeft--;
        timeElement.textContent = timeLeft;

        // Increase difficulty every 10 seconds
        if (timeLeft % 10 === 0 && level < MAX_LEVEL) {
            level++;
            vibrate([50, 50, 100]);

            // Show level up indicator
            showLevelUpIndicator();
        }

        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

// Show level up indicator
function showLevelUpIndicator() {
    const levelUpDiv = document.createElement('div');
    levelUpDiv.className = 'level-up-indicator';
    levelUpDiv.textContent = `LEVEL ${level}`;
    gameScreen.appendChild(levelUpDiv);

    // Remove after animation
    setTimeout(() => {
        levelUpDiv.classList.add('fade-out');
        setTimeout(() => {
            gameScreen.removeChild(levelUpDiv);
        }, 500);
    }, 1500);
}

// Clear all intervals
function clearAllIntervals() {
    clearInterval(bubbleSpawnInterval);
    clearInterval(obstacleSpawnInterval);
    clearInterval(starSpawnInterval);
    clearInterval(gameTimer);
}

// End the game
function endGame() {
    console.log("End game called");

    gameActive = false;
    clearAllIntervals();

    // Update UI
    finalScoreElement.textContent = score;

    // Check if we have a new high score
    if (score > highScore) {
        highScore = score;

        // Save high score to local storage
        try {
            localStorage.setItem('bubblePopHighScore', highScore.toString());
        } catch (e) {
            console.log('LocalStorage not available');
        }

        // Update UI
        updateHighScoreUI();

        // Show "New High Score!" message
        const existingHighScoreMsg = document.querySelector('.new-high-score');
        if (!existingHighScoreMsg) {
            const newHighScoreMsg = document.createElement('div');
            newHighScoreMsg.className = 'new-high-score';
            newHighScoreMsg.textContent = 'New High Score!';
            endScreen.insertBefore(newHighScoreMsg, restartButton);
        }
    }

    // Direct screen switch
    switchScreens(gameScreen, endScreen);

    // Vibrate for game over feedback
    vibrate([100, 50, 100, 50, 200]);
}

// Spawn a new bubble
function spawnBubble() {
    if (!gameActive) return;

    // Check if canvas is properly initialized
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
        console.log('Canvas not properly initialized for bubble spawning');
        return;
    }

    const radius = Math.random() * (BUBBLE_MAX_RADIUS - BUBBLE_MIN_RADIUS) + BUBBLE_MIN_RADIUS;
    const x = Math.random() * (canvas.width - radius * 2) + radius;
    const y = -radius;
    const speed = Math.random() * (BUBBLE_MAX_SPEED - BUBBLE_MIN_SPEED) + BUBBLE_MIN_SPEED;
    const hue = Math.floor(Math.random() * 360);

    // Calculate points - smaller bubbles are worth more points
    const points = Math.floor(BUBBLE_MAX_RADIUS / radius * 10);

    console.log(`Spawning bubble at x:${x}, y:${y}, radius:${radius}, speed:${speed}, points:${points}`);

    bubbles.push({
        x,
        y,
        radius,
        speed: speed * (1 + (level - 1) * 0.2), // Speed increases with level
        color: `hsl(${hue}, 80%, 65%)`,
        popped: false,
        popProgress: 0,
        points: points // Store the points value with the bubble
    });
}

// Spawn an obstacle
function spawnObstacle() {
    if (!gameActive || level < 2) return;

    const width = OBSTACLE_WIDTH;
    const height = OBSTACLE_HEIGHT;
    const x = Math.random() * (canvas.width - width);
    const y = -height;

    obstacles.push({
        x,
        y,
        width,
        height,
        speed: OBSTACLE_SPEED * (1 + (level - 1) * 0.1)
    });
}

// Spawn a star
function spawnStar() {
    if (!gameActive) return;

    const radius = STAR_RADIUS;
    const x = Math.random() * (canvas.width - radius * 2) + radius;
    const y = -radius;

    stars.push({
        x,
        y,
        radius,
        speed: STAR_SPEED,
        rotation: 0
    });
}

// Handle touch start event
function handleTouchStart(e) {
    e.preventDefault();

    if (!gameActive) return;

    // Process all touches
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const rect = canvas.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;

        // Create visual touch indicator
        createTouchIndicator(touchX, touchY);

        // Check if touch is in the bottom area of the screen (for player control)
        if (touchY > canvas.height * 0.8) {
            // This touch is for player control
            touchStartX = touchX;
            touchStartY = touchY;
            playerControlTouchId = touch.identifier;
            isSwiping = true;
            console.log(`Player control touch started with ID: ${playerControlTouchId}`);
        } else {
            // This touch is for bubble popping
            checkBubblePop(touchX, touchY);
        }
    }
}

// Check if a bubble was popped
function checkBubblePop(x, y) {
    // Check if player is touching a bubble
    for (let i = 0; i < bubbles.length; i++) {
        const bubble = bubbles[i];
        const dist = Math.hypot(x - bubble.x, y - bubble.y);

        if (dist <= bubble.radius && !bubble.popped) {
            // Pop bubble
            bubble.popped = true;

            // Haptic feedback
            vibrate(20);

            // Add score using the stored points value
            const points = bubble.points;
            score += points;
            scoreElement.textContent = score;

            // Show score popup at bubble position
            showScorePopup(bubble.x, bubble.y, points);

            return true;
        }
    }
    return false;
}

// Create visual touch indicator
function createTouchIndicator(x, y) {
    const indicator = document.createElement('div');
    indicator.className = 'touch-indicator';
    indicator.style.left = `${x}px`;
    indicator.style.top = `${y}px`;
    gameScreen.appendChild(indicator);

    // Remove after animation completes
    setTimeout(() => {
        if (gameScreen.contains(indicator)) {
            gameScreen.removeChild(indicator);
        }
    }, 800);
}

// Show score popup
function showScorePopup(x, y, points) {
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = `+${points}`;
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    gameScreen.appendChild(popup);

    // Remove after animation
    setTimeout(() => {
        gameScreen.removeChild(popup);
    }, 1000);
}

// Handle touch move event
function handleTouchMove(e) {
    e.preventDefault();

    if (!gameActive) return;

    // Process all touches
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        // Check if this is the player control touch
        if (touch.identifier === playerControlTouchId) {
            const rect = canvas.getBoundingClientRect();
            const touchX = touch.clientX - rect.left;

            // Move player horizontally based on swipe
            const deltaX = touchX - touchStartX;

            // For smoother movement, use a direct position approach rather than acceleration
            player.x = Math.max(0, Math.min(canvas.width - player.width,
                               player.x + (deltaX * playerSensitivity)));

            // Update start position for next move event
            touchStartX = touchX;
        } else {
            // For non-player control touches, check if they're popping bubbles
            const rect = canvas.getBoundingClientRect();
            const touchX = touch.clientX - rect.left;
            const touchY = touch.clientY - rect.top;

            // Create visual touch indicator
            createTouchIndicator(touchX, touchY);

            // Check if this touch is popping a bubble
            checkBubblePop(touchX, touchY);
        }
    }
}

// Handle touch end event
function handleTouchEnd(e) {
    e.preventDefault();

    // Process all touches
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        // Check if the player control touch ended
        if (touch.identifier === playerControlTouchId) {
            playerControlTouchId = null;
            isSwiping = false;
            console.log('Player control touch ended');
        }
    }
}

// Handle touch cancel event (similar to touch end)
function handleTouchCancel(e) {
    e.preventDefault();

    // Process all touches
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        // Check if the player control touch was canceled
        if (touch.identifier === playerControlTouchId) {
            playerControlTouchId = null;
            isSwiping = false;
            console.log('Player control touch canceled');
        }
    }
}

// Game loop
function gameLoop(timestamp) {
    if (!gameActive) return;

    // Calculate delta time for smooth animation
    const deltaTime = timestamp - lastFrameTime || 0;
    lastFrameTime = timestamp;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw game
    drawGame(deltaTime);

    // Check collisions
    checkCollisions();

    // Continue game loop
    requestAnimationFrame(gameLoop);
}

// Draw the entire game
function drawGame(deltaTime) {
    // Update and draw bubbles
    updateBubbles(deltaTime);

    // Update and draw obstacles
    updateObstacles(deltaTime);

    // Update and draw stars
    updateStars(deltaTime);

    // Draw player
    drawPlayer();
}

// Update and draw bubbles
function updateBubbles(deltaTime) {
    const speedFactor = deltaTime / 16.67; // Normalize based on 60fps

    for (let i = bubbles.length - 1; i >= 0; i--) {
        const bubble = bubbles[i];

        if (bubble.popped) {
            // Update pop animation
            bubble.popProgress += 0.1;
            if (bubble.popProgress >= 1) {
                bubbles.splice(i, 1);
            }
        } else {
            // Move bubble down
            bubble.y += bubble.speed * speedFactor;

            // Remove bubble if it's off the screen
            if (bubble.y - bubble.radius > canvas.height) {
                bubbles.splice(i, 1);
                continue;
            }
        }

        // Draw bubble
        if (!bubble.popped) {
            // Draw the bubble itself
            ctx.beginPath();
            ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
            ctx.fillStyle = bubble.color;
            ctx.fill();

            // Add shine effect
            const gradient = ctx.createRadialGradient(
                bubble.x - bubble.radius * 0.3,
                bubble.y - bubble.radius * 0.3,
                bubble.radius * 0.1,
                bubble.x,
                bubble.y,
                bubble.radius
            );
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.globalCompositeOperation = 'lighter';
            ctx.beginPath();
            ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';

            // Draw points value on the bubble
            const pointsText = `+${bubble.points}`;
            ctx.font = `bold ${Math.max(14, Math.floor(bubble.radius * 0.4))}px Fredoka, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 3;
            ctx.strokeText(pointsText, bubble.x, bubble.y);
            ctx.fillText(pointsText, bubble.x, bubble.y);
        } else {
            // Draw pop animation
            const scale = 1 + bubble.popProgress * 0.5;
            const alpha = 1 - bubble.popProgress;

            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(bubble.x, bubble.y, bubble.radius * scale, 0, Math.PI * 2);
            ctx.fillStyle = bubble.color;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }
}

// Update and draw obstacles
function updateObstacles(deltaTime) {
    const speedFactor = deltaTime / 16.67; // Normalize based on 60fps

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];

        // Move obstacle down
        obstacle.y += obstacle.speed * speedFactor;

        // Remove obstacle if it's off the screen
        if (obstacle.y > canvas.height) {
            obstacles.splice(i, 1);
            continue;
        }

        // Draw obstacle
        ctx.fillStyle = '#e74c3c';
        roundRect(ctx, obstacle.x, obstacle.y, obstacle.width, obstacle.height, 5);
    }
}

// Helper function to draw rounded rectangles
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}

// Update and draw stars
function updateStars(deltaTime) {
    const speedFactor = deltaTime / 16.67; // Normalize based on 60fps

    for (let i = stars.length - 1; i >= 0; i--) {
        const star = stars[i];

        // Move star down
        star.y += star.speed * speedFactor;

        // Rotate star
        star.rotation += 0.05;

        // Remove star if it's off the screen
        if (star.y - star.radius > canvas.height) {
            stars.splice(i, 1);
            continue;
        }

        // Draw star
        drawStar(star.x, star.y, star.radius, star.rotation);
    }
}

// Draw player
function drawPlayer() {
    // Draw player body (rounded rectangle)
    ctx.fillStyle = PLAYER_COLOR;
    roundRect(ctx, player.x, player.y, player.width, player.height, 10);

    // Add some details to player
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    roundRect(ctx, player.x + player.width * 0.2, player.y + player.height * 0.2, player.width * 0.6, player.height * 0.2, 5);
    roundRect(ctx, player.x + player.width * 0.2, player.y + player.height * 0.6, player.width * 0.6, player.height * 0.2, 5);
}

// Draw a star
function drawStar(x, y, radius, rotation) {
    const spikes = 5;
    const innerRadius = radius * 0.4;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();

    for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? radius : innerRadius;
        const angle = (Math.PI * i) / spikes;
        const starX = Math.cos(angle) * r;
        const starY = Math.sin(angle) * r;

        if (i === 0) {
            ctx.moveTo(starX, starY);
        } else {
            ctx.lineTo(starX, starY);
        }
    }

    ctx.closePath();
    ctx.fillStyle = '#f1c40f';
    ctx.fill();

    // Add shine effect to star
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 255, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();
}

// Check collisions
function checkCollisions() {
    // Player collision with stars
    for (let i = stars.length - 1; i >= 0; i--) {
        const star = stars[i];

        if (checkCollision(
            player.x, player.y, player.width, player.height,
            star.x - star.radius, star.y - star.radius, star.radius * 2, star.radius * 2
        )) {
            // Collect star
            stars.splice(i, 1);

            // Haptic feedback
            vibrate([30, 20, 30]);

            // Add score
            const starPoints = 50;
            score += starPoints;
            scoreElement.textContent = score;

            // Show score popup at star position
            showScorePopup(star.x, star.y, starPoints);
        }
    }

    // Player collision with obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];

        if (checkCollision(
            player.x, player.y, player.width, player.height,
            obstacle.x, obstacle.y, obstacle.width, obstacle.height
        )) {
            // End game on obstacle hit
            endGame();
            return;
        }
    }
}

// Check collision between two rectangles
function checkCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
    return (
        x1 < x2 + w2 &&
        x1 + w1 > x2 &&
        y1 < y2 + h2 &&
        y1 + h1 > y2
    );
}

// Add CSS for game animations
function addGameStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .score-popup {
            position: absolute;
            color: white;
            font-size: 1.5rem;
            font-weight: bold;
            pointer-events: none;
            animation: float-up 1s ease-out forwards;
            text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
            z-index: 100;
        }

        @keyframes float-up {
            0% {
                transform: translateY(0) scale(0.5);
                opacity: 0;
            }
            10% {
                transform: translateY(-10px) scale(1);
                opacity: 1;
            }
            100% {
                transform: translateY(-50px) scale(1.2);
                opacity: 0;
            }
        }

        .level-up-indicator {
            position: absolute;
            top: 60%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.7);
            color: #f1c40f;
            font-size: 2rem;
            font-weight: bold;
            padding: 15px 30px;
            border-radius: 10px;
            z-index: 100;
            animation: scale-in 0.5s ease-out;
        }

        .level-up-indicator.fade-out {
            animation: fade-out 0.5s ease-in forwards;
        }

        @keyframes scale-in {
            0% {
                transform: translate(-50%, -50%) scale(0.5);
                opacity: 0;
            }
            100% {
                transform: translate(-50%, -50%) scale(1);
                opacity: 1;
            }
        }

        @keyframes fade-out {
            0% {
                opacity: 1;
            }
            100% {
                opacity: 0;
            }
        }

        .new-high-score {
            color: #f1c40f;
            font-size: 1.5rem;
            font-weight: bold;
            margin-bottom: 15px;
            animation: pulse 1s infinite alternate;
            text-shadow: 0 0 10px rgba(241, 196, 15, 0.5);
        }

        @keyframes pulse {
            0% {
                transform: scale(1);
            }
            100% {
                transform: scale(1.1);
            }
        }
    `;
    document.head.appendChild(style);
}

// Function to remove the tiiny.host banner
function removeTiinyHostBanner() {
    let removed = false;

    // Look for the tiiny.host banner anchor
    const tiinyHostAnchor = document.querySelector('a[href*="tiiny.host?ref=free-site"]');

    // If found, remove its parent div
    if (tiinyHostAnchor) {
        const bannerDiv = tiinyHostAnchor.parentNode;
        if (bannerDiv) {
            console.log('Removing tiiny.host banner');
            bannerDiv.remove();
            removed = true;
        }
    }

    // Also try to find by class or id patterns that might be used
    const possibleBanners = document.querySelectorAll('.tiiny-host-banner, .tiiny-banner, [id*="tiiny"], [class*="tiiny"]');
    if (possibleBanners.length > 0) {
        possibleBanners.forEach(banner => {
            console.log('Removing possible tiiny.host banner element');
            banner.remove();
        });
        removed = true;
    }

    // Check for banners with position:fixed at the bottom or top
    const allElements = document.querySelectorAll('div');
    allElements.forEach(element => {
        const style = window.getComputedStyle(element);
        if (style.position === 'fixed' &&
            (style.bottom === '0px' || style.top === '0px')) {

            // Check if the element or its children contain references to tiiny.host
            if (element.innerHTML.includes('tiiny.host') ||
                element.querySelector('a[href*="tiiny"]')) {
                console.log('Removing fixed position banner');
                element.remove();
                removed = true;
            }
        }
    });

    // Check for iframes that might contain the banner
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
        try {
            // Check if the iframe src contains tiiny.host
            if (iframe.src && iframe.src.includes('tiiny.host')) {
                console.log('Removing tiiny.host iframe');
                iframe.remove();
                removed = true;
            }

            // Also check the parent element in case the iframe is part of a larger banner
            const parentEl = iframe.parentNode;
            if (parentEl && window.getComputedStyle(parentEl).position === 'fixed') {
                console.log('Removing parent of suspicious iframe');
                parentEl.remove();
                removed = true;
            }
        } catch (e) {
            // In case of cross-origin issues
            console.log('Error checking iframe:', e);
        }
    });

    // Apply additional CSS to ensure no fixed banners appear
    if (!document.getElementById('banner-blocker-styles')) {
        const style = document.createElement('style');
        style.id = 'banner-blocker-styles';
        style.textContent = `
            div[style*="fixed"][style*="bottom: 0"],
            div[style*="fixed"][style*="top: 0"] {
                display: none !important;
            }

            iframe[src*="tiiny.host"] {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
        removed = true;
    }

    return removed;
}

// Initialize the game when the window loads
window.addEventListener('load', () => {
    // Set correct viewport height for mobile
    setMobileViewportHeight();

    // Update viewport height when orientation changes or resize
    window.addEventListener('resize', () => {
        setMobileViewportHeight();
        setTimeout(resizeCanvas, 300); // Resize canvas after viewport has updated
    });

    init();
    addGameStyles();

    // Remove tiiny.host banner immediately
    removeTiinyHostBanner();

    // Set up a MutationObserver to detect when the banner might be added
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                // If new nodes were added, check if any of them are banners
                removeTiinyHostBanner();
            }
        }
    });

    // Start observing the document body for DOM changes
    observer.observe(document.body, { childList: true, subtree: true });

    // Also set up periodic checks to remove the banner in case it reappears
    const bannerRemovalInterval = setInterval(removeTiinyHostBanner, 1000);

    // After 10 seconds, reduce the frequency of checks
    setTimeout(() => {
        clearInterval(bannerRemovalInterval);
        setInterval(removeTiinyHostBanner, 5000);
    }, 10000);
});
