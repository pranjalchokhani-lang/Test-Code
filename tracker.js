const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let isResetting = false; 
let homeNode = null; // Will dynamically store the exact SVG shape of the home district

// 1. DYNAMICALLY LEARN THE HOME STATE ON LOAD
window.addEventListener('load', () => {
    // Give the map 1.5 seconds to finish drawing
    setTimeout(() => {
        // Find whichever shape has the 'active' or 'selected' class when the kiosk boots up
        homeNode = document.querySelector('path.active, path.selected, path[fill="#yourHighlightColor"]');
        
        // Generic fallback: If no active class, assume the first major clickable path is the home base
        if (!homeNode) {
            const allPaths = document.querySelectorAll('path');
            if (allPaths.length > 3) homeNode = allPaths[3]; // Typical offset for map layers
        }
        console.log("Tracker: Home state learned generically.");
    }, 1500);
});

// A function that fakes a deep, physical human touch to bypass React/D3 security
function forceReactClick(element) {
    if (!element) return;
    const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    events.forEach(ev => {
        element.dispatchEvent(new MouseEvent(ev, { bubbles: true, cancelable: true, view: window, buttons: 1 }));
    });
}

function finalizeSession() {
    // 1. Send data ONLY if valid and we aren't resetting
    if (totalClicks > 0 && !isResetting) {
        const payload = { 
            location: KIOSK_LOCATION, 
            clicks: totalClicks, 
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0, 
            breakdown: JSON.stringify(rawData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    
    // 2. ENGAGE THE BLINDFOLD
    isResetting = true;
    totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
    
    console.log("Tracker: 10s Idle. Reinitializing to home state...");

    // 3. FORCE THE RESET WITHOUT RELOADING
    // First, try clicking the map background to force a generic "deselect all" zoom-out
    const mapBackground = document.querySelector('svg');
    if (mapBackground) forceReactClick(mapBackground);

    // Second, forcefully click the exact Home Node we saved when the page loaded
    setTimeout(() => {
        if (homeNode) forceReactClick(homeNode);
    }, 300); // 300ms delay lets the background deselect register first

    // 4. REMOVE BLINDFOLD AFTER MAP SETTLES
    setTimeout(() => { 
        isResetting = false; 
        console.log("Tracker: Reset complete. Ready.");
    }, 1500);
}

function startSession() {
    if (isResetting) return; // Do not start a session during the auto-reset
    
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000); // 10-second idle window
}

// CAPTURE HUMAN CLICKS
document.addEventListener('mousedown', function(e) {
    if (isResetting) return; // Ignore clicks while blindfolded
    const target = e.target.closest('path, polygon, circle, rect');
    if (!target) return;

    startSession(); 
    totalClicks++;
    
    const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
    const rawIndex = allShapes.indexOf(target);
    rawData[rawIndex] = (rawData[rawIndex] || 0) + 1;
});

// KEEP ALIVE ON SCROLL/ZOOM
['wheel', 'touchmove', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, () => { if(!isResetting) startSession(); }, { passive: true });
});

// KEEP ALIVE ON SCROLL/ZOOM
['wheel', 'touchmove', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, () => { if(!isResetting) startSession(); }, { passive: true });
});
