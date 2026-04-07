const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

// ADD YOUR DISTRICT NAMES HERE IN ORDER OF THE SVG PATHS
const districtNames = ["Ajmer", "Bikaner", "Jaipur", "Jodhpur", "Sikar", "Udaipur"];

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
    
    // Find the clicked element
    const target = e.target.closest('path, polygon, circle');
    if (!target) return;

    totalClicks++;

    // Logic to find name since we can't edit HTML:
    // It looks for ID first, then Title, then calculates the "Index" number
    let name = target.id || target.getAttribute('title');
    
    if (!name || name === "path") {
        const allPaths = Array.from(document.querySelectorAll('path, polygon, circle'));
        const index = allPaths.indexOf(target);
        name = districtNames[index] || `Region-${index + 1}`;
    }

    districtData[name] = (districtData[name] || 0) + 1;
    resetIdleTimer();
});

resetIdleTimer();
window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sendData(); });
window.addEventListener('pagehide', sendData);
