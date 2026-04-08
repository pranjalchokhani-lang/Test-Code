// CAPTURE THE EXACT URL ON BOOT UP (Before anyone clicks anything)
// =========================================================================
// KIOSK TELEMETRY: MASTER TRACKER (V3)
// =========================================================================
(function() {
    // --- CONFIGURATION ---
    const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 
    const IDLE_TIMEOUT = 10000; // 10s inactivity = Reset
    const HOME_DISTRICT_ID = "1"; // Change to your Home/Rajkot ID

    // --- SESSION STATE ---
    let sessionData = {
        location: window.location.pathname, // Sends the path for the script to parse
        clicks: 0,
        duration: 0,
        breakdown: {}
    };

    let startTime = null;
    let lastInteractionTime = null;
    let idleTimer = null;
    let sessionActive = false;

    // --- SESSION CONTROL ---

    function startNewSession() {
        sessionActive = true;
        startTime = Date.now();
        lastInteractionTime = startTime;
        sessionData.clicks = 0;
        sessionData.breakdown = {};
        console.log("🚀 Session Started via Physical Touch");
    }

    function resetIdleTimer() {
        if (!sessionActive) return;
        
        lastInteractionTime = Date.now();
        clearTimeout(idleTimer);
        idleTimer = setTimeout(finalizeSession, IDLE_TIMEOUT);
    }

    function finalizeSession() {
        if (!sessionActive) return;

        // Actual Interaction Time (Last Touch - First Touch)
        sessionData.duration = Math.round((lastInteractionTime - startTime) / 1000);

        // Send Data to Master Vault (9-Column Script)
        fetch(APPS_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            cache: "no-cache",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sessionData)
        });

        console.log("✅ Data Transmitted. Cleaning UI...");

        // Perform Functional Reset (Clears ghost data)
        performUIReset();

        sessionActive = false;
        startTime = null;
    }

    function performUIReset() {
        // Target the SVG Home element
        const homeElement = document.querySelector(`[data-id="${HOME_DISTRICT_ID}"]`) || 
                            document.getElementById(`district-${HOME_DISTRICT_ID}`);

        if (homeElement) {
            // Simulated Click to force text panels and ripples to sync
            homeElement.dispatchEvent(new Event('click', { bubbles: true }));
        }
    }

    // --- EVENT LISTENERS (TOUCH & CLICK) ---

    // 1. Map Interaction
    document.addEventListener('click', function(e) {
        const target = e.target.closest('path, polygon');
        if (!target) return;

        if (!sessionActive) startNewSession();

        const districtId = target.getAttribute('data-id') || target.id;
        if (districtId) {
            sessionData.clicks++;
            sessionData.breakdown[districtId] = (sessionData.breakdown[districtId] || 0) + 1;
        }
        resetIdleTimer();
    });

    // 2. Physical Activity (Scroll/Zoom/Touch)
    // Prevents reset as long as touch is underway
    const activeEvents = ['touchstart', 'touchmove', 'touchend', 'mousedown', 'wheel', 'scroll'];
    
    activeEvents.forEach(event => {
        window.addEventListener(event, function() {
            if (!sessionActive) startNewSession();
            resetIdleTimer();
        }, { passive: true });
    });

})();
