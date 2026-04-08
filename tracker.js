// --- CONFIGURATION ---
const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec";  

// CHANGE 1: Capture Full URL Path for Folder/File extraction
const KIOSK_LOCATION = window.location.href; 

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let isResetting = true; 
document.body.style.pointerEvents = 'none'; 

// --- STATE MEMORY VAULT ---
let homeDistrictName = "";  
let mapSvg = null;          
let mapGroup = null;        
let initialViewBox = null;  
let initialTransform = null;
let homeElement = null; // Captured to trigger functional reset

// 3. RAPID-FIRE 0th STATE SCANNER
const bootScan = setInterval(() => {
    const activePath = document.querySelector('path.on'); 
    
    if (activePath) {
        homeDistrictName = activePath.getAttribute('data-n');
        homeElement = activePath; // Lock the physical home element
        mapSvg = activePath.closest('svg') || document.querySelector('svg');
        mapGroup = activePath.closest('g') || document.querySelector('svg > g');
        
        if (mapSvg) initialViewBox = mapSvg.getAttribute('viewBox');
        if (mapGroup) initialTransform = mapGroup.getAttribute('transform');

        console.log("Tracker: 0th state locked safely ->", homeDistrictName);
        
        clearInterval(bootScan); 
        document.body.style.pointerEvents = 'auto'; 
        isResetting = false; 
    }
}, 100); 

function finalizeSession() {
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
    totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
    
    console.log("Tracker: 10s Idle. Executing UI, Data & Ripple Reset...");

    // CHANGE 2: RESET DATA AND RIPPLES
    // Instead of just painting CSS, we trigger a programmatic click on the Home Element.
    // This forces your map's internal logic to update ripples and text panels.
    if (homeElement) {
        const resetEvent = { bubbles: true, cancelable: true, view: window };
        homeElement.dispatchEvent(new MouseEvent('click', resetEvent));
    }

    // VISUAL ALIGNMENT
    if (mapSvg && initialViewBox) {
        mapSvg.style.transition = "all 0.5s ease-in-out";
        mapSvg.setAttribute('viewBox', initialViewBox);
    }
    if (mapGroup && initialTransform) {
        mapGroup.style.transition = "transform 0.5s ease-in-out";
        mapGroup.setAttribute('transform', initialTransform);
    }

    setTimeout(() => {
        document.querySelectorAll('path.on').forEach(p => p.classList.remove('on'));
        if (homeElement) homeElement.classList.add('on');

        setTimeout(() => {
            if (mapSvg) mapSvg.style.transition = "";
            if (mapGroup) mapGroup.style.transition = "";
            isResetting = false; 
            console.log("Tracker: Reset complete.");
        }, 500);
    }, 600); 
}

// CHANGE 3: START SESSION ON TOUCH
function startSession() {
    if (isResetting) return; 
    
    // session starts on the first interaction (touch or click)
    if (!startTime) {
        startTime = Date.now();
        console.log("Tracker: Session Started via Touch/Interaction");
    }
    
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000); 
}

// CAPTURE CLICKS
document.addEventListener('mousedown', function(e) {
    if (isResetting) return;
    
    // Ensure session starts even if the click is on a non-district area
    startSession(); 

    const target = e.target.closest('path, polygon, circle, rect');
    if (!target) return;

    totalClicks++;
    const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
    const rawIndex = allShapes.indexOf(target);
    rawData[rawIndex] = (rawData[rawIndex] || 0) + 1;
});

// CHANGE 3: START & KEEP ALIVE ON ALL TOUCH/SCROLL
['wheel', 'touchmove', 'touchstart', 'scroll'].forEach(ev => {
    document.addEventListener(ev, () => { 
        if(!isResetting) startSession(); 
    }, { passive: true });
});
