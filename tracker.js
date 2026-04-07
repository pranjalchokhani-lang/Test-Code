const scriptUrl = 
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0;
let districtData = {}; 
let startTime = null; 
let idleTimer;

function sendData() {
    if (totalClicks === 0 || !startTime) return;
    
    const payload = {
        location: KIOSK_LOCATION,
        clicks: totalClicks,
        duration: Math.floor((Date.now() - startTime) / 1000),
        breakdown: JSON.stringify(districtData) 
    };

    // FIX: Disguise the data as text/plain to bypass browser security blocks (CORS)
    const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain' });
    
    // sendBeacon guarantees the data is sent even if the page is currently refreshing
    navigator.sendBeacon(scriptUrl, blob); 
    
    totalClicks = 0; districtData = {}; startTime = null;
}

function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        if (totalClicks > 0) { 
            sendData(); 
            // Give the browser 200 milliseconds to fire the beacon before reloading
            setTimeout(() => { window.location.reload(); }, 200);
        }
    }, 60000); 
}

document.addEventListener('click', function(e) {
    if (!startTime) { startTime = Date.now(); }
    totalClicks++;
    let id = e.target.id || e.target.innerText?.substring(0, 15).trim() || e.target.tagName;
    districtData[id] = (districtData[id] || 0) + 1;
    resetIdleTimer();
});

resetIdleTimer();
window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sendData(); });
window.addEventListener('pagehide', sendData);
