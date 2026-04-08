const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 
const scriptUrl = "PASTE_YOUR_DEPLOYED_WEB_APP_URL_HERE"; 
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let homeDistrict = ""; 

// 1. CAPTURE HOME NAME & ATTEMPT TO FIND RESET BUTTON
function initTracker() {
    const label = document.querySelector('.title, #selected-name, .district-label'); 
    if (label && label.innerText.trim() !== "") {
        homeDistrict = label.innerText.trim();
        console.log("Tracker Active. Home set to: " + homeDistrict);
    } else {
        setTimeout(initTracker, 1000);
    }
}
initTracker();

function finalizeSession() {
    if (totalClicks > 0) {
        const payload = { 
            location: KIOSK_LOCATION, 
            clicks: totalClicks, 
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0, 
            breakdown: JSON.stringify(rawData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    
    // RESET TRACKER MEMORY
    totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
    
    // 2. MULTI-STRATEGY RESET
    console.log("10s Idle: Attempting Map Reset...");

    // Strategy A: Native select() function
    if (typeof window.select === "function" && homeDistrict !== "") {
        window.select(homeDistrict); 
    } 
    
    // Strategy B: Click the "Home" icon if it exists (Common in Leaflet/D3 maps)
    const homeBtn = document.querySelector('.leaflet-control-home, .home-button, #reset-btn, .back-button');
    if (homeBtn) homeBtn.click();

    // Strategy C: Dispatch a custom 'click' to the background to deselect
    const mapBg = document.querySelector('svg, #map, .leaflet-container');
    if (mapBg) {
        mapBg.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
    }
}

function startSession() {
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000); 
}

document.addEventListener('mousedown', function(e) {
    const target = e.target.closest('path, polygon, circle, rect');
    startSession(); 
    if (!target) return;

    totalClicks++;
    const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
    const rawIndex = allShapes.indexOf(target);
    rawData[rawIndex] = (rawData[rawIndex] || 0) + 1;
});

['wheel', 'touchmove', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, startSession, { passive: true });
});
