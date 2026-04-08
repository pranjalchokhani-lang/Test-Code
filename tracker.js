const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let isResetting = false; 
let homeDistrict = "";

// Capture the starting name just in case we need it
window.addEventListener('load', () => {
    setTimeout(() => {
        const label = document.querySelector('.title, #selected-name, .district-label'); 
        if (label) homeDistrict = label.innerText.trim();
    }, 1500);
});

// The Ghost Click Function: Simulates a real human clicking the mouse
function simulateHumanClick(element) {
    const options = { bubbles: true, cancelable: true, view: window };
    element.dispatchEvent(new MouseEvent('pointerdown', options));
    element.dispatchEvent(new MouseEvent('mousedown', options));
    element.dispatchEvent(new MouseEvent('pointerup', options));
    element.dispatchEvent(new MouseEvent('mouseup', options));
    element.dispatchEvent(new MouseEvent('click', options));
}

function finalizeSession() {
    // 1. Send data only if valid clicks exist and we are NOT resetting
    if (totalClicks > 0 && !isResetting) {
        const payload = { 
            location: KIOSK_LOCATION, 
            clicks: totalClicks, 
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0, 
            breakdown: JSON.stringify(rawData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    
    // 2. ACTIVATE BLINDFOLD
    isResetting = true;
    totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
    
    // 3. EXECUTE FOOLPROOF RESET
    console.log("Tracker: 10s Idle. Executing Ghost Click Reset...");
    
    // Attempt A: Use the map's native select function if it exists
    if (typeof window.select === "function" && homeDistrict) {
        window.select(homeDistrict); 
    } 
    // Attempt B: The Ghost Click on the map background (forces D3/React maps to zoom out/reset)
    else {
        const mapBackground = document.querySelector('svg'); 
        if (mapBackground) {
            simulateHumanClick(mapBackground); 
        }
        
        // Attempt C: If there is a physical "Home" or "Reset" button on the UI, ghost click it
        const homeButton = document.querySelector('.home-btn, #reset, .back-btn, .leaflet-control-home');
        if (homeButton) simulateHumanClick(homeButton);
    }

    // 4. REMOVE BLINDFOLD AFTER MAP SETTLES
    setTimeout(() => { 
        isResetting = false; 
        console.log("Tracker: Reset complete. Ready for new student.");
    }, 1500);
}

function startSession() {
    if (isResetting) return; // Completely ignore touches during reset
    
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000); // 10-Second timeout
}

document.addEventListener('mousedown', function(e) {
    if (isResetting) return; // Do not count clicks during auto-reset
    
    const target = e.target.closest('path, polygon, circle, rect');
    if (!target) return;

    startSession(); 
    totalClicks++;
    
    const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
    const rawIndex = allShapes.indexOf(target);
    rawData[rawIndex] = (rawData[rawIndex] || 0) + 1;
});

// Keep session alive during scrolling/zooming
['wheel', 'touchmove', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, () => { if(!isResetting) startSession(); }, { passive: true });
});

// Watch for scrolling/zooming to keep session alive
['wheel', 'touchmove', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, () => { if(!isResetting) startSession(); }, { passive: true });
});
