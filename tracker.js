// CAPTURE THE EXACT URL ON BOOT UP (Before anyone clicks anything)
const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec";  
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let isResetting = false; 

// Memory Vault for Initial State
let homeDistrictName = ""; 
let mapGroup = null;       // The SVG layer that controls zoom/pan
let initialTransform = ""; // The exact coordinates/zoom level

// 1. MEMORIZE DISTRICT & ZOOM COORDINATES ON BOOT UP
window.addEventListener('load', () => {
    setTimeout(() => {
        const homePath = document.querySelector('path.on'); 
        if (homePath) {
            homeDistrictName = homePath.getAttribute('data-n');
            
            // Find the main map layer that holds the zoom/pan coordinates
            mapGroup = homePath.closest('g') || document.querySelector('svg g');
            if (mapGroup) {
                initialTransform = mapGroup.getAttribute('transform') || "";
            }
            console.log("Tracker: Locked Home District [" + homeDistrictName + "] and Initial Zoom coordinates.");
        }
    }, 1500); // Wait 1.5s for map to settle before memorizing
});

function finalizeSession() {
    // 1. Send Data
    if (totalClicks > 0 && !isResetting) {
        const payload = { 
            location: KIOSK_LOCATION, 
            clicks: totalClicks, 
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0, 
            breakdown: JSON.stringify(rawData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    
    // 2. Engage Blindfold
    isResetting = true;
    totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
    
    console.log("Tracker: 10s Idle. Zooming out and resetting...");

    // 3. ZERO-RELOAD VISUAL ALIGNMENT (Zoom & Pan Reset)
    if (mapGroup) {
        // Apply a smooth half-second transition so the map glides back into place
        mapGroup.style.transition = "transform 0.5s ease-in-out";
        
        // Force the map back to its exact starting size and alignment
        mapGroup.setAttribute('transform', initialTransform);
        
        // Remove the transition rule after it finishes so the next student can drag it normally
        setTimeout(() => { mapGroup.style.transition = ""; }, 600);
    }

    // 4. CLICK THE HOME DISTRICT
    // We add a tiny 300ms delay to let the zoom-out animation start before clicking the district
    setTimeout(() => {
        if (homeDistrictName !== "") {
            const targetShape = document.querySelector(`path[data-n="${homeDistrictName}"]`);
            if (targetShape) {
                const opt = { bubbles: true, cancelable: true, view: window };
                targetShape.dispatchEvent(new MouseEvent('pointerdown', opt));
                targetShape.dispatchEvent(new MouseEvent('mousedown', opt));
                targetShape.dispatchEvent(new MouseEvent('pointerup', opt));
                targetShape.dispatchEvent(new MouseEvent('mouseup', opt));
                targetShape.dispatchEvent(new MouseEvent('click', opt));
            }
        }
    }, 300);

    // 5. Remove Blindfold
    setTimeout(() => { 
        isResetting = false; 
    }, 1000);
}

function startSession() {
    if (isResetting) return; 
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000); // 10-second timeout
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

// KEEP ALIVE ON DRAG/ZOOM
['wheel', 'touchmove', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, () => { if(!isResetting) startSession(); }, { passive: true });
});
