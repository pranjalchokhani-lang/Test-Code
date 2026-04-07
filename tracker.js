const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec";
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

    const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain' });
    navigator.sendBeacon(scriptUrl, blob); 
    
    totalClicks = 0; districtData = {}; startTime = null;
}

function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        if (totalClicks > 0) { 
            sendData(); 
            setTimeout(() => { window.location.reload(); }, 200);
        }
    }, 60000); 
}

document.addEventListener('click', function(e) {
    if (!startTime) { startTime = Date.now(); }
    totalClicks++;

    // SMART IDENTIFICATION:
    // 1. Checks for an ID (e.g., id="Ajmer")
    // 2. Checks for a Title tag (common in maps)
    // 3. Checks for text inside the element
    let label = e.target.id || 
                e.target.getAttribute('title') || 
                e.target.querySelector('title')?.textContent || 
                e.target.innerText?.substring(0, 15).trim() || 
                "Unknown Region";

    districtData[label] = (districtData[label] || 0) + 1;
    resetIdleTimer();
});

resetIdleTimer();
window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sendData(); });
window.addEventListener('pagehide', sendData);
