const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

const offsets = { "SIKAR": 3, "GUJARAT": 3, "JAIPUR": 3, "CHANDIGARH": 3 };
const homeDistricts = { "JAIPUR": "Jaipur", "SIKAR": "Jhunjhunu", "GUJARAT": "Rajkot", "CHANDIGARH": "Panchkula", "TRI-CITY": "Panchkula" };

const regionNames = { /* ... keep your full lists here ... */ };

let totalClicks = 0, districtData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let isAutoReset = false; // THE FLAG: Prevents auto-reset from being counted

function reinitialiseSession() {
    // 1. Send data if there was a real user
    if (totalClicks > 0) {
        sendData();
    }
    
    // 2. Wipe memory
    totalClicks = 0;
    districtData = {};
    startTime = null;
    lastInteractionTime = null;
    
    // 3. Trigger the Visual Reset
    autoResetMap();
}

function autoResetMap() {
    const homeName = homeDistricts[KIOSK_LOCATION];
    if (!homeName) return;

    const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
    const listKey = (KIOSK_LOCATION === "CHANDIGARH" || KIOSK_LOCATION === "TRI-CITY") ? "CHANDIGARH" : KIOSK_LOCATION;
    const homeIndex = regionNames[listKey].indexOf(homeName);

    if (homeIndex !== -1) {
        const rawHomeIndex = homeIndex + (offsets[listKey] || 0);
        const targetShape = allShapes[rawHomeIndex];

        if (targetShape) {
            isAutoReset = true; // RAISE THE FLAG
            targetShape.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            isAutoReset = false; // LOWER THE FLAG
            console.log("Map Reset to " + homeName + ". Not counted in sessions.");
        }
    }
}

function sendData() {
    let dur = startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0;
    const payload = {
        location: KIOSK_LOCATION,
        clicks: totalClicks,
        duration: dur,
        breakdown: JSON.stringify(districtData) 
    };
    fetch(scriptUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
}

function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(reinitialiseSession, 10000); // 10-second window
}

document.addEventListener('mousedown', function(e) {
    // IF THE FLAG IS UP, DO NOTHING
    if (isAutoReset) return;

    const target = e.target.closest('path, polygon, circle, rect');
    startSession(); 
    if (!target) return;

    totalClicks++;
    const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
    const rawIndex = allShapes.indexOf(target);
    let listKey = (KIOSK_LOCATION === "CHANDIGARH" || KIOSK_LOCATION === "TRI-CITY") ? "CHANDIGARH" : KIOSK_LOCATION;
    const currentMapNames = regionNames[listKey] || [];
    const correctedIndex = rawIndex - (offsets[listKey] || 0);
    let name = currentMapNames[correctedIndex] || "Unknown (" + rawIndex + ")";

    districtData[name] = (districtData[name] || 0) + 1;
    console.log(`User Click: ${name}`);
});

function startSession() {
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    resetIdleTimer();
}

['wheel', 'touchmove', 'touchstart', 'mousemove'].forEach(ev => {
    document.addEventListener(ev, startSession, { passive: true });
});
