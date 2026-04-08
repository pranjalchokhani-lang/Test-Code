// CAPTURE THE EXACT URL ON BOOT UP (Before anyone clicks anything)
// =========================================================================
// KIOSK TELEMETRY: MASTER TRACKER (V3 - With Zero-Click Logic)
// =========================================================================
(function() {
    // --- CONFIGURATION ---
    const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 
    const IDLE_TIMEOUT = 10000; // 10s inactivity = Reset
    const HOME_DISTRICT_ID = "1"; // Change to your Home/Rajkot ID

    // Clean up location path (e.g., "/jaipur.html" becomes "JAIPUR")
    let rawLocation = window.location.pathname.split('/').pop().replace('.html', '').toUpperCase();

    // --- SESSION STATE ---
    let sessionData = {
        location: rawLocation || "UNKNOWN", 
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
        console.log("🚀 Session Started (Interaction Detected)");
    }

    function resetIdleTimer() {
        if (!sessionActive) return;
        
        lastInteractionTime = Date.now();
        clearTimeout(idleTimer);
        idleTimer = setTimeout(finalizeSession, IDLE_TIMEOUT);
    }

    function finalizeSession() {
        if (!sessionActive) return;

        // Actual Interaction Time (Last Touch - First Touch). 
        // Forced to at least 1 second so a quick single tap doesn't record as 0 seconds.
        sessionData.duration = Math.max(1, Math.round((lastInteractionTime - startTime) / 1000));

        // CREATE FINAL PAYLOAD
        // CRITICAL FIX: 'breakdown' must be converted to a string before sending, 
        // otherwise Google Sheets writes "[object Object]" and breaks your formulas.
        const finalPayload = {
            location: sessionData.location,
            clicks: sessionData.clicks,
            duration: sessionData.duration,
            breakdown: JSON.stringify(sessionData.breakdown) 
        };

        console.log("📦 Sending Data:", finalPayload);

        // Send Data to Master Vault (9-Column Script)
        fetch(APPS_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            cache: "no-cache",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(finalPayload)
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

    // 1. Map Interaction (Specific District Clicks)
    document.addEventListener('click', function(e) {
        const target = e.target.closest('path, polygon');
        if (!target) return; // Ignores empty space clicks (Event Listener #2 catches those)

        if (!sessionActive) startNewSession();

        const districtId = target.getAttribute('data-id') || target.id;
        if (districtId) {
            sessionData.clicks++;
            sessionData.breakdown[districtId] = (sessionData.breakdown[districtId] || 0) + 1;
        }
        resetIdleTimer();
    });

    // 2. Physical Activity (Scroll/Zoom/Touch/Empty space clicks)
    // THE ZERO-TOUCH PIECE: This guarantees a session starts and stays active
    // even if a student pans around the map for 3 minutes but never taps a shape.
    const activeEvents = ['touchstart', 'touchmove', 'touchend', 'mousedown', 'wheel', 'scroll'];
    
    activeEvents.forEach(event => {
        window.addEventListener(event, function() {
            if (!sessionActive) startNewSession();
            resetIdleTimer();
        }, { passive: true });
    });

})();
