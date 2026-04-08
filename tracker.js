// --- CONFIGURATION ---
const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec";  

// 1. Capture Full URL Path for Folder/File extraction
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
let homeElement = null; 

// 3. RAPID-FIRE 0th STATE SCANNER
const bootScan = setInterval(() => {
    const activePath = document.querySelector('path.on'); 
    
    if (activePath) {
        homeDistrictName = activePath.getAttribute('data-n');
        homeElement = activePath; 
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
    
    console.log("Tracker: 10s Idle. Executing UI, Data & Ripple Reset...");

    // --- STEP 1: TRIGGER FUNCTIONAL RESET (Ripples & Data) ---
    // We target the CURRENTLY active path to "unclick" it. 
    // This triggers the map's native "go back to home" logic.
    const activePath = document.querySelector('path.on');
    if (activePath) {
        const resetEvent = { bubbles: true, cancelable: true, view: window };
        // Dispatching both pointer and click ensures the data panel hears it
        activePath.dispatchEvent(new MouseEvent('click', resetEvent));
    }

    // --- STEP 2: FORCE VISUAL ALIGNMENT ---
    // We delay this slightly so it doesn't conflict with the 'click' zoom-out
    setTimeout(() => {
        if (mapSvg && initialViewBox) {
            mapSvg.style.transition = "all 0.8s ease-in-out";
            mapSvg.setAttribute('viewBox', initialViewBox);
        }
        if (mapGroup && initialTransform) {
            mapGroup.style.transition = "transform 0.8s ease-in-out";
            mapGroup.setAttribute('transform', initialTransform);
        }
    }, 50);

    // --- STEP 3: CLEANUP CSS CLASSES ---
    setTimeout(() => {
        document.querySelectorAll('path.on').forEach(p => p.classList.remove('on'));
        if (homeElement) homeElement.classList.add('on');

        setTimeout(() => {
            if (mapSvg) mapSvg.style.transition = "";
            if (mapGroup) mapGroup.style.transition = "";
            
            // Final Clear for next session
            totalClicks = 0; 
            rawData = {}; 
            startTime = null; 
            lastInteractionTime = null;
            isResetting = false; 
            console.log("Tracker: Reset complete.");
        }, 500);
    }, 700); 
}

function startSession() {
    if (isResetting) return; 
    
    if (!startTime) {
        startTime = Date.now();
        console.log("Tracker: Session Started via Interaction");
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

// START & KEEP ALIVE ON TOUCH/SCROLL
['wheel', 'touchmove', 'touchstart', 'scroll'].forEach(ev => {
    document.addEventListener(ev, () => { 
        if(!isResetting) startSession(); 
    }, { passive: true });
});
