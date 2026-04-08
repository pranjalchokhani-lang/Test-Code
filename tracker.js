// CAPTURE THE EXACT URL ON BOOT UP (Before anyone clicks anything)
const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec";  
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let isResetting = false; 

// --- STATE MEMORY VAULT ---
let homeElement = null;     // Stores the exact physical SVG shape
let mapSvg = null;          // Stores the main SVG canvas
let mapGroup = null;        // Stores the zooming layer
let initialViewBox = null;  // Memorizes the zoom scale
let initialTransform = null;// Memorizes the pan alignment

// 1. RAPID-FIRE SCANNER (Locks home state instantly before anyone can touch it)
const bootScan = setInterval(() => {
    // Look for the active district
    const activePath = document.querySelector('path.on'); 
    
    if (activePath) {
        homeElement = activePath;
        
        // Find the map layers and memorize their exact zoom/pan coordinates
        mapSvg = activePath.closest('svg') || document.querySelector('svg');
        mapGroup = activePath.closest('g') || document.querySelector('svg > g');
        
        if (mapSvg) initialViewBox = mapSvg.getAttribute('viewBox');
        if (mapGroup) initialTransform = mapGroup.getAttribute('transform');

        console.log("Tracker: Initial state locked instantly ->", homeElement.getAttribute('data-n'));
        
        // Stop scanning once we have the data
        clearInterval(bootScan); 
    }
}, 100); // Scans every 1/10th of a second

function finalizeSession() {
    // 1. SEND DATA
    if (totalClicks > 0 && !isResetting) {
        const payload = { 
            location: KIOSK_LOCATION, 
            clicks: totalClicks, 
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0, 
            breakdown: JSON.stringify(rawData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    
    // 2. ENGAGE BLINDFOLD
    isResetting = true;
    totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
    
    console.log("Tracker: 10s Idle. Executing Zero-Reload Align & Reset...");

    // 3. FORCE VISUAL ZOOM-OUT & RE-ALIGN
    if (mapSvg && initialViewBox) {
        mapSvg.style.transition = "all 0.5s ease-in-out";
        mapSvg.setAttribute('viewBox', initialViewBox);
    }
    if (mapGroup && initialTransform) {
        mapGroup.style.transition = "transform 0.5s ease-in-out";
        mapGroup.setAttribute('transform', initialTransform);
    }

    // 4. CLICK THE BACKGROUND (Forces the framework to clear its memory)
    if (mapSvg) {
        mapSvg.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 1, clientY: 1 }));
    }

    // 5. RE-SELECT THE EXACT HOME DISTRICT
    setTimeout(() => {
        if (homeElement) {
            const opt = { bubbles: true, cancelable: true, view: window };
            ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(ev => {
                homeElement.dispatchEvent(new MouseEvent(ev, opt));
            });
        }

        // Clean up the transition locks so the next student can zoom normally
        setTimeout(() => {
            if (mapSvg) mapSvg.style.transition = "";
            if (mapGroup) mapGroup.style.transition = "";
            isResetting = false; 
            console.log("Tracker: Reset complete.");
        }, 500);

    }, 400); // Wait 400ms for the zoom-out to happen before clicking home
}

function startSession() {
    if (isResetting) return; 
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000); 
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
