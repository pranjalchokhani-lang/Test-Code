// =========================================================================
// KIOSK TELEMETRY: MASTER TRACKER (V5 - DEEP RESET FIX)
// =========================================================================

const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec";  
const KIOSK_LOCATION = window.location.href; // Captures Full Path

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let isResetting = true; 
document.body.style.pointerEvents = 'none'; 

// --- STATE MEMORY VAULT ---
let homeDistrictName = "";  
let mapSvg = null;          
let mapGroup = null;        
let initialViewBox = null;  
let initialTransform = null;
let homeElement = null; 

// BOOT SCANNER: Locks Jhunjhunu as the Home Anchor
const bootScan = setInterval(() => {
    const activePath = document.querySelector('path.on'); 
    
    if (activePath) {
        homeDistrictName = activePath.getAttribute('data-n');
        homeElement = activePath; 
        mapSvg = activePath.closest('svg') || document.querySelector('svg');
        mapGroup = activePath.closest('g') || document.querySelector('svg > g');
        
        if (mapSvg) initialViewBox = mapSvg.getAttribute('viewBox');
        if (mapGroup) initialTransform = mapGroup.getAttribute('transform');

        console.log("Tracker: Home state locked ->", homeDistrictName);
        
        clearInterval(bootScan); 
        document.body.style.pointerEvents = 'auto'; 
        isResetting = false; 
    }
}, 100); 

function finalizeSession() {
    // 1. DATA TRANSMISSION
    if (totalClicks > 0 && !isResetting) {
        const payload = { 
            location: KIOSK_LOCATION, 
            clicks: totalClicks, 
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0, 
            breakdown: JSON.stringify(rawData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    
    isResetting = true;
    
    console.log("Tracker: 10s Idle. Executing Deep Data Sync & Reset...");

    // --- THE FIX: FORCING THE REGEX/DATA RESET ---
    if (homeElement) {
        // We create a "Tap" sequence that modern touchscreens use.
        // Firing just 'click' often misses the data panel update.
        const opt = { bubbles: true, cancelable: true, view: window, buttons: 1, isPrimary: true };
        
        // Sequence: PointerDown -> MouseDown -> PointerUp -> MouseUp -> Click
        // This forces every possible listener to acknowledge Jhunjhunu
        homeElement.dispatchEvent(new PointerEvent('pointerdown', opt));
        homeElement.dispatchEvent(new MouseEvent('mousedown', opt));
        
        setTimeout(() => {
            homeElement.dispatchEvent(new PointerEvent('pointerup', opt));
            homeElement.dispatchEvent(new MouseEvent('mouseup', opt));
            homeElement.dispatchEvent(new MouseEvent('click', opt));
        }, 50); // 50ms pause mimics a human finger lift
    }

    // 2. VISUAL ZOOM-OUT
    if (mapSvg && initialViewBox) {
        mapSvg.style.transition = "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)";
        mapSvg.setAttribute('viewBox', initialViewBox);
    }
    if (mapGroup && initialTransform) {
        mapGroup.style.transition = "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)";
        mapGroup.setAttribute('transform', initialTransform);
    }

    // 3. CLEANUP CLASSES
    setTimeout(() => {
        document.querySelectorAll('path.on').forEach(p => p.classList.remove('on'));
        if (homeElement) homeElement.classList.add('on');

        setTimeout(() => {
            if (mapSvg) mapSvg.style.transition = "";
            if (mapGroup) mapGroup.style.transition = "";
            
            // RESET COUNTERS
            totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
            isResetting = false; 
            console.log("Tracker: Full Reset Successful.");
        }, 500);
    }, 800); 
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
