// --- CONFIGURATION ---
const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec";  
const KIOSK_LOCATION = window.location.href; // Captures full URL/Folder/Path

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let isResetting = true; 
document.body.style.pointerEvents = 'none'; 

// --- STATE MEMORY VAULT ---
let homeDistrictName = "";  
let mapSvg = null;          
let mapGroup = null;        
let initialViewBox = null;  
let initialTransform = null;
let homeElement = null; 

// 3. RAPID-FIRE 0th STATE SCANNER (Locks Jhunjhunu as Home)
const bootScan = setInterval(() => {
    const activePath = document.querySelector('path.on'); 
    
    if (activePath) {
        homeDistrictName = activePath.getAttribute('data-n');
        homeElement = activePath; // THIS IS JHUNJHUNU
        mapSvg = activePath.closest('svg') || document.querySelector('svg');
        mapGroup = activePath.closest('g') || document.querySelector('svg > g');
        
        if (mapSvg) initialViewBox = mapSvg.getAttribute('viewBox');
        if (mapGroup) initialTransform = mapGroup.getAttribute('transform');

        console.log("Tracker: Home locked ->", homeDistrictName);
        
        clearInterval(bootScan); 
        document.body.style.pointerEvents = 'auto'; 
        isResetting = false; 
    }
}, 100); 

function finalizeSession() {
    // 1. SEND DATA TO SHEET
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
    
    console.log("Tracker: 10s Idle. Executing Full Data & Visual Reset...");

    // --- THE JHUNJHUNU SYNC FIX ---
    if (homeElement) {
        // We create a simulated user click. 
        // This is the ONLY way to force the ripples and text panel to update.
        const opts = { bubbles: true, cancelable: true, view: window, buttons: 1 };
        
        // Sequence mimics a real finger tap
        homeElement.dispatchEvent(new MouseEvent('mousedown', opts));
        homeElement.dispatchEvent(new MouseEvent('mouseup', opts));
        homeElement.dispatchEvent(new MouseEvent('click', opts));
    }

    // FORCE VISUAL ZOOM-OUT
    if (mapSvg && initialViewBox) {
        mapSvg.style.transition = "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
        mapSvg.setAttribute('viewBox', initialViewBox);
    }
    if (mapGroup && initialTransform) {
        mapGroup.style.transition = "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
        mapGroup.setAttribute('transform', initialTransform);
    }

    // CLEANUP CLASSES
    setTimeout(() => {
        document.querySelectorAll('path.on').forEach(p => p.classList.remove('on'));
        if (homeElement) homeElement.classList.add('on');

        setTimeout(() => {
            if (mapSvg) mapSvg.style.transition = "";
            if (mapGroup) mapGroup.style.transition = "";
            
            // RESET DATA FOR NEXT USER
            totalClicks = 0; 
            rawData = {}; 
            startTime = null; 
            lastInteractionTime = null;
            isResetting = false; 
            console.log("Tracker: Full Reset Complete.");
        }, 500);
    }, 600); 
}

// SESSION STARTS ON ANY TOUCH (NOT JUST CLICK)
function startSession() {
    if (isResetting) return; 
    
    if (!startTime) {
        startTime = Date.now();
        console.log("Tracker: Session Started via Physical Interaction");
    }
    
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000); 
}

// CAPTURE CLICKS
document.addEventListener('mousedown', function(e) {
    if (isResetting) return;
    
    startSession(); 

    const target = e.target.closest('path, polygon, circle, rect');
    if (!target) return;

    totalClicks++;
    const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
    const rawIndex = allShapes.indexOf(target);
    rawData[rawIndex] = (rawData[rawIndex] || 0) + 1;
});

// START & KEEP ALIVE ON ALL TOUCH/SCROLL/WHEEL
['wheel', 'touchmove', 'touchstart', 'scroll'].forEach(ev => {
    document.addEventListener(ev, () => { 
        if(!isResetting) startSession(); 
    }, { passive: true });
});
