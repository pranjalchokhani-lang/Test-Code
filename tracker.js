// CAPTURE THE EXACT URL ON BOOT UP (Before anyone clicks anything)
const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec";  
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let isResetting = false; 
let homeDistrictName = ""; // We will store "Sabarkantha" (or whatever city) here

// 1. LEARN THE HOME STATE ON BOOT UP
window.addEventListener('load', () => {
    // Wait 1.5 seconds for the map to finish drawing
    setTimeout(() => {
        // Look for the exact shape that has the "on" class
        const homePath = document.querySelector('path.on'); 
        if (homePath) {
            // Extract the secret name (e.g., "Sabarkantha")
            homeDistrictName = homePath.getAttribute('data-n');
            console.log("Tracker: Success! Home is locked to [" + homeDistrictName + "]");
        } else {
            console.warn("Tracker: Could not find a path with the 'on' class.");
        }
    }, 1500);
});

function finalizeSession() {
    // 1. SEND DATA (Only if clicks exist and we are not resetting)
    if (totalClicks > 0 && !isResetting) {
        const payload = { 
            location: KIOSK_LOCATION, 
            clicks: totalClicks, 
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0, 
            breakdown: JSON.stringify(rawData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    
    // 2. PUT ON THE BLINDFOLD
    isResetting = true;
    totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
    
    console.log("Tracker: 10s Idle. Returning to " + homeDistrictName);

    // 3. ZERO-RELOAD PHYSICAL CLICK
    if (homeDistrictName !== "") {
        // Find the exact shape on the map that matches the home name
        const targetShape = document.querySelector(`path[data-n="${homeDistrictName}"]`);
        
        if (targetShape) {
            // Simulate a flawless physical human click directly on the shape
            const opt = { bubbles: true, cancelable: true, view: window };
            targetShape.dispatchEvent(new MouseEvent('pointerdown', opt));
            targetShape.dispatchEvent(new MouseEvent('mousedown', opt));
            targetShape.dispatchEvent(new MouseEvent('pointerup', opt));
            targetShape.dispatchEvent(new MouseEvent('mouseup', opt));
            targetShape.dispatchEvent(new MouseEvent('click', opt));
        }
    }

    // 4. REMOVE BLINDFOLD AFTER 1 SECOND
    setTimeout(() => { 
        isResetting = false; 
    }, 1000);
}

function startSession() {
    if (isResetting) return; 
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000); // 10-Second timeout
}

// CAPTURE CLICKS
document.addEventListener('mousedown', function(e) {
    if (isResetting) return;
    const target = e.target.closest('path, polygon, circle, rect');
    if (!target) return;

    startSession(); 
    totalClicks++;
    
    const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
    const rawIndex = allShapes.indexOf(target);
    rawData[rawIndex] = (rawData[rawIndex] || 0) + 1;
});

// KEEP ALIVE
['wheel', 'touchmove', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, () => { if(!isResetting) startSession(); }, { passive: true });
});

// KEEP ALIVE
['wheel', 'touchmove', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, () => { if(!isResetting) startSession(); }, { passive: true });
});
