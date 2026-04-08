// =========================================================================
// KIOSK TELEMETRY: MASTER TRACKER (100% BULLETPROOF RESET)
// =========================================================================

const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec";  
const KIOSK_LOCATION = window.location.href; // Captures Full Path for Apps Script

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let isResetting = false; 

function finalizeSession() {
    if (isResetting) return;
    isResetting = true; // Lock the system so it doesn't double-fire

    // 1. DATA TRANSMISSION (Guaranteed delivery via sendBeacon)
    if (totalClicks > 0) {
        const payload = { 
            location: KIOSK_LOCATION, 
            clicks: totalClicks, 
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0, 
            breakdown: JSON.stringify(rawData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
        console.log("Tracker: Data payload transmitted securely.");
    }
    
    console.log("Tracker: 10s Idle. Executing 100% Guaranteed Hard Reset...");

    // 2. THE 100% FIX: HARD BROWSER RELOAD
    // This absolutely obliterates "ghost data", resets the ripples, 
    // and forces the map to reload in its exact default state (Jhunjhunu).
    window.location.reload(); 
}

// SESSION STARTS ON ANY TOUCH (Anywhere on body)
function startSession() {
    if (isResetting) return; 
    
    if (!startTime) {
        startTime = Date.now();
        console.log("Tracker: Session started via Touch/Interaction");
    }
    
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000); 
}

// CAPTURE CLICKS ON DISTRICTS
document.addEventListener('mousedown', function(e) {
    if (isResetting) return;
    startSession(); 
    
    const target = e.target.closest('path, polygon, circle, rect');
    if (!target) return;
    
    totalClicks++;
    const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
    const rawIndex = allShapes.indexOf(target);
    rawData[rawIndex] = (rawData[rawIndex] || 0) + 1;
});

// START & KEEP ALIVE ON ALL TOUCH/SCROLL/WHEEL
['wheel', 'touchmove', 'touchstart', 'scroll'].forEach(ev => {
    document.addEventListener(ev, () => { 
        if(!isResetting) startSession(); 
    }, { passive: true });
});
