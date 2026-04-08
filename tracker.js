const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 
const scriptUrl = "PASTE_YOUR_DEPLOYED_WEB_APP_URL_HERE"; 
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let homeDistrict = "";
let homeElement = null;
let isResetting = false; 

// 1. CAPTURE INITIAL STATE
window.addEventListener('load', () => {
    setTimeout(() => {
        const label = document.querySelector('.title, #selected-name, .district-label'); 
        if (label) homeDistrict = label.innerText.trim();
        homeElement = document.querySelector('path.selected, path.active, .active-region');
        console.log("Tracker: Initial state locked. Home is " + homeDistrict);
    }, 1500);
});

function finalizeSession() {
    // 1. SEND DATA IF VALID
    if (totalClicks > 0 && !isResetting) {
        const payload = { 
            location: KIOSK_LOCATION, 
            clicks: totalClicks, 
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0, 
            breakdown: JSON.stringify(rawData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    
    // 2. ENGAGE LOCK (BLINDFOLD)
    isResetting = true;
    totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
    
    console.log("Tracker: 10s Idle. Executing Multi-Tool Reset...");

    // 3. THE MULTI-TOOL RESET
    // Tool A: Native map function
    if (typeof window.select === "function" && homeDistrict) {
        try { window.select(homeDistrict); } catch(e) {}
    }
    
    // Tool B: Simulate pressing "Escape" (Standard accessibility shortcut to deselect)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    
    // Tool C: Click the map background (forces zoom-out/deselect)
    const svgBg = document.querySelector('svg');
    if (svgBg) {
        svgBg.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 1, clientY: 1 }));
        svgBg.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 1, clientY: 1 }));
    }

    // Tool D: Click the original home element if we caught it
    if (homeElement) {
        homeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }

    // 4. DISENGAGE LOCK AFTER 1.5 SECONDS
    setTimeout(() => { 
        isResetting = false; 
        console.log("Tracker: Reset complete.");
    }, 1500);
}

function startSession() {
    if (isResetting) return; // Completely ignore touches during the reset sequence
    
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

// KEEP ALIVE ON SCROLL/ZOOM
['wheel', 'touchmove', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, () => { if(!isResetting) startSession(); }, { passive: true });
});
