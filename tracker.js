const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let homeDistrict = ""; 
let homeElement = null; // Stores the physical SVG shape of the home district
let isResetting = false; // The absolute lock

// 1. CAPTURE HOME NAME & SHAPE ON PAGE LOAD
window.addEventListener('load', () => {
    // Give the map 1.5 seconds to finish drawing itself
    setTimeout(() => {
        const label = document.querySelector('.title, #selected-name, .district-label'); 
        if (label) homeDistrict = label.innerText.trim();
        
        // Find the physical SVG element that is currently selected (the starting state)
        homeElement = document.querySelector('path.selected, path.active, .active-region') || document.querySelector('svg path');
        console.log("Tracker: Home locked to [" + homeDistrict + "]");
    }, 1500);
});

function finalizeSession() {
    // 1. SEND DATA (Only if clicks happened and we aren't already resetting)
    if (totalClicks > 0 && !isResetting) {
        const payload = { 
            location: KIOSK_LOCATION, 
            clicks: totalClicks, 
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0, 
            breakdown: JSON.stringify(rawData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    
    // 2. PUT ON THE BLINDFOLD (Lock the tracker)
    isResetting = true;
    totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
    
    // 3. FORCE THE RESET
    console.log("Tracker: 10s Idle. Executing blind reset...");
    
    // Method A: The native function
    if (typeof window.select === "function" && homeDistrict !== "") {
        window.select(homeDistrict); 
    } 
    // Method B: Synthetic physical click on the home shape (Foolproof fallback)
    else if (homeElement) {
        homeElement.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
        homeElement.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    }

    // 4. TAKE OFF BLINDFOLD AFTER MAP SETTLES (1.5 seconds)
    setTimeout(() => { 
        isResetting = false; 
        console.log("Tracker: Reset complete. Ready for next user.");
    }, 1500);
}

function startSession() {
    // IF THE BLINDFOLD IS ON, IGNORE EVERYTHING
    if (isResetting) return; 
    
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000); // 10-Second Idle
}

document.addEventListener('mousedown', function(e) {
    if (isResetting) return; // Ignore clicks during auto-reset
    const target = e.target.closest('path, polygon, circle, rect');
    if (!target) return;

    startSession(); 
    totalClicks++;
    const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
    const rawIndex = allShapes.indexOf(target);
    rawData[rawIndex] = (rawData[rawIndex] || 0) + 1;
});

// Watch for scrolling/zooming to keep session alive
['wheel', 'touchmove', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, () => { if(!isResetting) startSession(); }, { passive: true });
});
