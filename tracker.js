const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let homeDistrict = ""; 

window.addEventListener('load', () => {
    const label = document.querySelector('.title, #selected-name, .district-label'); 
    if (label) homeDistrict = label.innerText.trim();
});

function finalizeSession() {
    if (totalClicks > 0) {
        const payload = { location: KIOSK_LOCATION, clicks: totalClicks, duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0, breakdown: JSON.stringify(rawData) };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
    if (typeof select === "function" && homeDistrict) select(homeDistrict); 
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
