/* ============================================================
   Futory Cards — Demo Gate
   Free 10-minute daily play limit. On mobile the old always-on
   ticking timer overlapped the section nav, so it's replaced by a
   one-time Welcome message; the 10-minute cutoff is unchanged.
   The countdown starts when the player dismisses the Welcome, so
   reading it (or the future tutorial) never costs demo time.
   ============================================================ */

const DEMO_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const STORAGE_KEY_START = 'futoryDemoStartTime';
const STORAGE_KEY_DATE = 'futoryDemoDate';

const ARCADE_URL = 'https://simonallmer.com/arcade';

const ACCENT = '#00e5ff';
const ACCENT_DIM = 'rgba(0, 229, 255, 0.4)';
const TEXT_DIM = 'rgba(220, 235, 245, 0.7)';

/* ---------- Daily bookkeeping ---------- */

function getTodayDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function isNewDay() {
    return localStorage.getItem(STORAGE_KEY_DATE) !== getTodayDateString();
}

// A fresh day clears the start stamp — the clock (re)starts when the player
// dismisses the Welcome, not on page load.
function initDemoDay() {
    if (isNewDay()) {
        localStorage.setItem(STORAGE_KEY_DATE, getTodayDateString());
        localStorage.removeItem(STORAGE_KEY_START);
    }
}

function hasStarted() {
    return !!localStorage.getItem(STORAGE_KEY_START);
}

function startPlayClock() {
    if (!hasStarted()) localStorage.setItem(STORAGE_KEY_START, Date.now().toString());
}

/* ---------- Time math ---------- */

function getRemainingTime() {
    if (!hasStarted()) return DEMO_DURATION_MS;
    const startTime = parseInt(localStorage.getItem(STORAGE_KEY_START), 10) || Date.now();
    return Math.max(0, DEMO_DURATION_MS - (Date.now() - startTime));
}

function isDemoExpired() {
    return hasStarted() && getRemainingTime() <= 0;
}

/* ---------- Welcome message (shown once per day, before play) ---------- */

function showWelcomeMessage(onStart) {
    if (document.getElementById('demo-welcome-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'demo-welcome-overlay';
    overlay.style.cssText = `
        position: fixed; inset: 0;
        background: rgba(6, 9, 13, 0.92);
        backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center;
        z-index: 100000;
        font-family: 'Rajdhani', sans-serif;
        padding: 24px;
    `;
    overlay.innerHTML = `
        <div style="max-width: 460px; text-align: center; color: #e6f6ff;">
            <p style="font-size: 0.85rem; letter-spacing: 0.28em; color: ${ACCENT}; text-transform: uppercase; margin-bottom: 14px;">Welcome to the free demo of</p>
            <h1 style="font-family: 'Cinzel', serif; font-size: 2.1rem; letter-spacing: 0.12em; color: #fff; text-shadow: 0 0 20px ${ACCENT_DIM}; margin: 0 0 22px;">FUTORY CARDS</h1>
            <p style="font-size: 1.02rem; line-height: 1.7; letter-spacing: 0.03em; color: ${TEXT_DIM}; margin-bottom: 32px;">
                You have <strong style="color:${ACCENT};">10 minutes</strong> of free play per day.
                Your time starts when you tap below.
            </p>
            <button id="demo-welcome-start" style="
                display: inline-block; padding: 14px 46px;
                font-family: 'Cinzel', serif; font-size: 1rem; font-weight: 700;
                color: #04121a; background: ${ACCENT};
                border: none; border-radius: 4px; cursor: pointer;
                letter-spacing: 0.16em; text-transform: uppercase;
                box-shadow: 0 0 24px ${ACCENT_DIM};
            ">Start Playing</button>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('demo-welcome-start').addEventListener('click', () => {
        overlay.remove();
        if (typeof onStart === 'function') onStart();
    });
}

/* ---------- Expired blocker (the actual 10-minute cutoff) ---------- */

function showExpiredOverlay() {
    if (document.getElementById('demo-expired-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'demo-expired-overlay';
    overlay.style.cssText = `
        position: fixed; inset: 0;
        background: rgba(6, 9, 13, 0.94);
        backdrop-filter: blur(6px);
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        z-index: 100001;
        color: #e6f6ff;
        font-family: 'Rajdhani', sans-serif;
        text-align: center; padding: 24px;
    `;
    overlay.innerHTML = `
        <h1 style="font-family: 'Cinzel', serif; font-size: 1.9rem; letter-spacing: 0.14em; color: ${ACCENT}; text-shadow: 0 0 18px ${ACCENT_DIM}; margin-bottom: 18px;">DEMO TIME ENDED</h1>
        <p style="font-size: 1.05rem; letter-spacing: 0.06em; color: ${TEXT_DIM}; margin-bottom: 12px;">Your daily 10 minutes of free play are up.</p>
        <p style="font-size: 0.95rem; max-width: 420px; line-height: 1.7; color: ${TEXT_DIM}; margin-bottom: 34px;">Play Futory Cards without limits &mdash; and every other game &mdash; with an Arcade subscription.</p>
        <a href="${ARCADE_URL}" target="_top" rel="noopener noreferrer" style="
            display: inline-block; padding: 13px 42px;
            font-family: 'Cinzel', serif; font-size: 0.95rem; font-weight: 700;
            color: #04121a; background: ${ACCENT};
            border: none; border-radius: 4px; cursor: pointer;
            text-decoration: none; letter-spacing: 0.16em; text-transform: uppercase;
            box-shadow: 0 0 22px ${ACCENT_DIM};
        ">Enter the Arcade</a>
        <p style="margin-top: 22px; font-size: 0.8rem; letter-spacing: 0.1em; color: rgba(220,235,245,0.4);">Come back tomorrow for another free demo run.</p>
    `;
    document.body.appendChild(overlay);
}

/* ---------- Expiration watcher ---------- */

function startExpirationChecker() {
    const checkInterval = setInterval(() => {
        if (isDemoExpired()) {
            clearInterval(checkInterval);
            showExpiredOverlay();
        }
    }, 1000);
}

/* ---------- Boot ---------- */

function bootDemoGate() {
    initDemoDay();
    if (isDemoExpired()) {
        showExpiredOverlay();          // already used today's 10 minutes
    } else if (!hasStarted()) {
        showWelcomeMessage(() => {     // first run today — clock starts on dismiss
            startPlayClock();
            startExpirationChecker();
        });
    } else {
        startExpirationChecker();      // mid-session reload
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootDemoGate);
} else {
    bootDemoGate();
}
