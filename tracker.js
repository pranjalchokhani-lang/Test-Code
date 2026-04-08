// 1. CAPTURE THE FULL URL FOR THE APPS SCRIPT
const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec";  
const FULL_URL_PATH = window.location.href; 

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let isResetting = true; 

// PHYSICAL SHIELD ON BOOT
document.body.style.pointerEvents = 'none'; 

// --- STATE MEMORY VAULT ---
let homeDistrictName = "";  
let mapSvg = null;          
let mapGroup = null;        
let initialViewBox = null;  
let initialTransform = null;
let homeElement = null; 

// 3. BOOT SCANNER (Locks the starting state)
const bootScan = setInterval(() => {
    const activePath = document.querySelector('path.on'); 
    
    if (activePath) {
        homeDistrictName = activePath.getAttribute('data-n');
        homeElement = activePath; // THIS IS THE RESET ANCHOR
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
    // 1. SEND DATA
    if (totalClicks > 0 && !isResetting) {
        const payload = { 
            location: FULL_URL_PATH, // Pulls full directory structure
            clicks: totalClicks, 
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0, 
            breakdown: JSON.stringify(rawData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    
    // 2. ENGAGE RESET
    isResetting = true;
    totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
    
    console.log("Tracker: 10s Idle. Executing UI & Data Reset...");

    // 3. FORCE FUNCTIONAL RESET (Syncs Text Panel & Ripples)
    if (homeElement) {
        // We use a broader event dispatch to ensure the Map's logic catches the click
        const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
        });
        homeElement.dispatchEvent(clickEvent);
    }

    // 4. FORCE VISUAL ALIGNMENT (Zoom out)
    if (mapSvg && initialViewBox) {
        mapSvg.style.transition = "all 0.6s cubic-bezier(0.45, 0.05, 0.55, 0.95)";
        mapSvg.setAttribute('viewBox', initialViewBox);
    }
    if (mapGroup && initialTransform) {
        mapGroup.style.transition = "transform 0.6s cubic-bezier(0.45, 0.05, 0.55, 0.95)";
        mapGroup.setAttribute('transform', initialTransform);
    }

    // 5. CLEANUP CLASSES
    setTimeout(() => {
        document.querySelectorAll('path.on').forEach(p => p.classList.remove('on'));
        if (homeElement) homeElement.classList.add('on');

        setTimeout(() => {
            if (mapSvg) mapSvg.style.transition = "";
            if (mapGroup) mapGroup.style.transition = "";
            isResetting = false; 
            console.log("Tracker: Reset successful.");
        }, 500);
    }, 600); 
}

// 6. SESSION STARTS ON ANY TOUCH
function startSession() {
    if (isResetting) return; 
    
    // Lock startTime on the very first touch/interaction
    if (!startTime) {
        startTime = Date.now();
        console.log("Tracker: Session initiated via interaction.");
    }
    
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

// START SESSION & KEEP ALIVE ON ALL TOUCH/SCROLL
['wheel', 'touchmove', 'touchstart', 'scroll'].forEach(ev => {
    document.addEventListener(ev, () => { 
        if(!isResetting) startSession(); 
    }, { passive: true });
});
