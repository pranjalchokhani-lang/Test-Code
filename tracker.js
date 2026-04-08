const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let homeDistrict = ""; 

// 1. IMPROVED HOME CAPTURE
function findHomeName() {
    // Looks for the specific label class used in your map (title or selected-name)
    const label = document.querySelector('.title, #selected-name, .district-label, #district-name'); 
    if (label && label.innerText.trim() !== "") {
        homeDistrict = label.innerText.trim();
        console.log("Tracker: Home District set to [" + homeDistrict + "]");
    } else {
        // Retry every second until the map loads the initial name
        setTimeout(findHomeName, 1000);
    }
}
findHomeName();

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
    
    // RESET INTERNALS
    totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
    
    // 2. THE RESET TRIGGER
    // We use window.select to ensure we are calling the global map function
    if (typeof window.select === "function" && homeDistrict !== "") {
        console.log("Tracker: 10s Idle. Executing select('" + homeDistrict + "')");
        window.select(homeDistrict); 
    } else {
        console.warn("Tracker: Reset failed. homeDistrict is empty or select() is missing.");
    }
}

function startSession() {
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    // 10-SECOND IDLE WINDOW
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

// Capture all forms of interaction to prevent early reset
['wheel', 'touchmove', 'touchstart', 'click'].forEach(ev => {
    document.addEventListener(ev, startSession, { passive: true });
});
