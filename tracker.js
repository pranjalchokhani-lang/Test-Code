// =========================================================================
// KIOSK TELEMETRY: MASTER TRACKER (V4)
// =========================================================================

// 1. CAPTURE THE FULL URL (Includes Folders/Directories)
const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec";  
const FULL_URL_PATH = window.location.href; // Captures http://.../gujarat/map.html

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let isResetting = true; 

document.body.style.pointerEvents = 'none'; 

// --- STATE MEMORY VAULT ---
let homeDistrictName = "";  
let mapSvg = null;          
let mapGroup = null;        
let initialViewBox = null;  
let initialTransform = null;
let homeElement = null; // Stores the physical element to re-click on reset

const bootScan = setInterval(() => {
    const activePath = document.querySelector('path.on'); 
    
    if (activePath) {
        homeDistrictName = activePath.getAttribute('data-n');
        homeElement = activePath; // Lock the home element
        mapSvg = activePath.closest('svg') || document.querySelector('svg');
        mapGroup = activePath.closest('g') || document.querySelector('svg > g');
        
        if (mapSvg) initialViewBox = mapSvg.getAttribute('viewBox');
        if (mapGroup) initialTransform = mapGroup.getAttribute('transform');

        console.log("Tracker: 0th state locked safely ->", homeDistrictName);
        
        clearInterval(bootScan); 
        document.body.style.pointerEvents = 'auto'; 
        isResetting = false; 
    }
}, 100); 

function finalizeSession() {
    if (totalClicks > 0 && !isResetting) {
        const payload = { 
            location: FULL_URL_PATH, // Sends full URL for Folder/File extraction in Sheet
            clicks: totalClicks, 
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0, 
            breakdown: JSON.stringify(rawData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    
    isResetting = true;
    totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
    
    console.log("Tracker: 10s Idle. Executing Zero-Reload Align & Reset...");

    // CHANGE 2: RESET DATA & RIPPLES
    // Instead of just painting CSS, we "click" the home element.
    // This forces ripples and result panels to update back to Home (e.g. Rajkot)
    if (homeElement) {
        const opt = { bubbles: true, cancelable: true, view: window };
        homeElement.dispatchEvent(new MouseEvent('click', opt));
    }

    // FORCE VISUAL ALIGNMENT
    if (mapSvg && initialViewBox) {
        mapSvg.style.transition = "all 0.5s ease-in-out";
        mapSvg.setAttribute('viewBox', initialViewBox);
    }
    if (mapGroup && initialTransform) {
        mapGroup.style.transition = "transform 0.5s ease-in-out";
        mapGroup.setAttribute('transform', initialTransform);
    }

    setTimeout(() => {
        // Final CSS Cleanup
        document.querySelectorAll('path.on').forEach(p => p.classList.remove('on'));
        if (homeElement) homeElement.classList.add('on');

        setTimeout(() => {
            if (mapSvg) mapSvg.style.transition = "";
            if (mapGroup) mapGroup.style.transition = "";
            isResetting = false; 
            console.log("Tracker: Reset complete.");
        }, 500);
    }, 600); 
}

// CHANGE 3: START SESSION ON ANY TOUCH
function startSession() {
    if (isResetting) return; 
    
    // Lock start time on the very first touch/interaction
    if (!startTime) {
        startTime = Date.now();
        console.log("Tracker: Session started via Touch/Interaction");
    }
    
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000); 
}

// CAPTURE CLICKS (AND TOUCH START)
document.addEventListener('mousedown', function(e) {
    if (isResetting) return;
    
    // If it's the first interaction, start session immediately
    startSession(); 

    const target = e.target.closest('path, polygon, circle, rect');
    if (!target) return;

    totalClicks++;
    const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
    const rawIndex = allShapes.indexOf(target);
    rawData[rawIndex] = (rawData[rawIndex] || 0) + 1;
});

// CHANGE 3: LISTEN TO ALL TOUCH/SCROLL TO START & KEEP ALIVE
['wheel', 'touchmove', 'touchstart', 'scroll'].forEach(ev => {
    document.addEventListener(ev, () => { 
        if(!isResetting) startSession(); 
    }, { passive: true });
});
