/* ============================================================
   Futory Cards — Demo Timer
   10-minute daily play limit + Arcade subscription advertising.
   Themed to match the Futory Cards sci-fi UI (cyan accent, Rajdhani).
   ============================================================ */

const DEMO_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const STORAGE_KEY_START = 'futoryDemoStartTime';
const STORAGE_KEY_DATE = 'futoryDemoDate';

const ARCADE_URL = 'https://simonallmer.com/arcade';
const ARCADE_ABOUT_URL = 'https://simonallmer.com/aboutarcade';

const ACCENT = '#00e5ff';
const ACCENT_DIM = 'rgba(0, 229, 255, 0.4)';
const PANEL_BG = 'rgba(12, 16, 22, 0.92)';
const TEXT_DIM = 'rgba(220, 235, 245, 0.65)';

/* ---------- Daily reset bookkeeping ---------- */

function getTodayDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function isNewDay() {
    return localStorage.getItem(STORAGE_KEY_DATE) !== getTodayDateString();
}

function resetDemo() {
    localStorage.setItem(STORAGE_KEY_START, Date.now().toString());
    localStorage.setItem(STORAGE_KEY_DATE, getTodayDateString());
}

function initDemo() {
    if (isNewDay()) {
        resetDemo();
    }
}

/* ---------- Time math ---------- */

function getRemainingTime() {
    initDemo();
    const startTime = parseInt(localStorage.getItem(STORAGE_KEY_START), 10) || Date.now();
    const elapsed = Date.now() - startTime;
    return Math.max(0, DEMO_DURATION_MS - elapsed);
}

function isDemoExpired() {
    return getRemainingTime() <= 0;
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/* ---------- Expired overlay ---------- */

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
        z-index: 100000;
        color: #e6f6ff;
        font-family: 'Rajdhani', sans-serif;
        text-align: center; padding: 24px;
    `;
    overlay.innerHTML = `
        <h1 style="font-family: 'Cinzel', serif; font-size: 1.9rem; letter-spacing: 0.14em; color: ${ACCENT}; text-shadow: 0 0 18px ${ACCENT_DIM}; margin-bottom: 18px;">DEMO TIME ENDED</h1>
        <p style="font-size: 1.05rem; letter-spacing: 0.06em; color: ${TEXT_DIM}; margin-bottom: 12px;">Your daily 10 minutes of free play are up.</p>
        <p style="font-size: 0.95rem; max-width: 420px; line-height: 1.7; color: ${TEXT_DIM}; margin-bottom: 34px;">Play Futory Cards without limits — and every other game — with an Arcade subscription.</p>
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

/* ---------- Subscription popup (from clicking the timer) ---------- */

function showSubscriptionPopup() {
    if (document.getElementById('subscription-popup')) return;

    const popup = document.createElement('div');
    popup.id = 'subscription-popup';
    popup.style.cssText = `
        position: fixed; inset: 0;
        background: rgba(6, 9, 13, 0.85);
        backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        z-index: 100001;
        font-family: 'Rajdhani', sans-serif;
    `;
    popup.innerHTML = `
        <div style="background: linear-gradient(150deg, #12202b 0%, #0a1016 100%);
                    border: 1px solid ${ACCENT_DIM}; border-radius: 8px;
                    box-shadow: 0 0 40px rgba(0,229,255,0.18);
                    padding: 38px; max-width: 440px; text-align: center; color: #e6f6ff;">
            <h2 style="font-family: 'Cinzel', serif; color: ${ACCENT}; font-size: 1.3rem; letter-spacing: 0.14em; text-shadow: 0 0 14px ${ACCENT_DIM}; margin-bottom: 20px;">ARCADE SUBSCRIPTION</h2>
            <p style="line-height: 1.75; font-size: 1rem; letter-spacing: 0.04em; color: ${TEXT_DIM}; margin-bottom: 28px;">This is a free 10-minute daily demo. Unlock unlimited play with an Arcade subscription.</p>
            <a href="${ARCADE_ABOUT_URL}" target="_top" rel="noopener noreferrer" style="
                display: inline-block; padding: 13px 40px;
                font-family: 'Cinzel', serif; font-size: 0.9rem; font-weight: 700;
                color: #04121a; background: ${ACCENT};
                border: none; border-radius: 4px; cursor: pointer;
                text-decoration: none; letter-spacing: 0.15em; text-transform: uppercase;
                box-shadow: 0 0 20px ${ACCENT_DIM};
            ">Learn More</a>
            <button id="subscription-popup-close" style="
                display: block; margin: 20px auto 0;
                background: none; border: none; color: rgba(220,235,245,0.45);
                font-family: 'Rajdhani', sans-serif; font-size: 0.8rem;
                cursor: pointer; letter-spacing: 0.12em;
            ">CLOSE</button>
        </div>
    `;

    popup.addEventListener('click', (e) => {
        if (e.target === popup) popup.remove();
    });
    document.body.appendChild(popup);
    document.getElementById('subscription-popup-close').addEventListener('click', () => popup.remove());
}

/* ---------- Permanent bottom-left timer ---------- */

function addPermanentTimer() {
    if (document.getElementById('permanent-demo-timer')) return;

    const timer = document.createElement('div');
    timer.id = 'permanent-demo-timer';
    timer.style.cssText = `
        position: fixed; bottom: 18px; left: 18px;
        padding: 8px 15px;
        background: ${PANEL_BG};
        border: 1px solid ${ACCENT_DIM};
        border-radius: 6px;
        font-family: 'Rajdhani', sans-serif;
        font-size: 0.8rem; letter-spacing: 0.08em;
        color: ${TEXT_DIM};
        z-index: 99999;
        backdrop-filter: blur(8px);
        box-shadow: 0 0 16px rgba(0,229,255,0.12);
        cursor: pointer;
        transition: border-color 0.3s ease, box-shadow 0.3s ease;
        user-select: none;
    `;
    timer.title = 'Demo play limit — click for Arcade info';

    updateTimerContent(timer);
    document.body.appendChild(timer);

    timer.addEventListener('click', showSubscriptionPopup);
    timer.addEventListener('mouseenter', () => {
        timer.style.borderColor = ACCENT;
        timer.style.boxShadow = '0 0 22px rgba(0,229,255,0.3)';
    });
    timer.addEventListener('mouseleave', () => {
        timer.style.borderColor = ACCENT_DIM;
        timer.style.boxShadow = '0 0 16px rgba(0,229,255,0.12)';
    });

    setInterval(() => updateTimerContent(timer), 1000);
}

function updateTimerContent(timer) {
    if (!timer) timer = document.getElementById('permanent-demo-timer');
    if (!timer) return;

    const remaining = getRemainingTime();
    const isLow = remaining > 0 && remaining <= 60000;

    if (isDemoExpired()) {
        timer.innerHTML = `
            <span style="color: rgba(220,235,245,0.5);">DEMO ENDED</span>
            <span style="margin: 0 8px; color: ${ACCENT_DIM};">|</span>
            <a href="${ARCADE_URL}" target="_top" rel="noopener noreferrer" style="color: ${ACCENT}; text-decoration: none; font-weight: 600;" onclick="event.stopPropagation()">Subscribe</a>
        `;
    } else {
        timer.innerHTML = `
            <span style="color: rgba(220,235,245,0.55);">DEMO</span>
            <span style="color: ${isLow ? '#ff5f6d' : ACCENT}; font-weight: 700; margin-left: 8px; min-width: 42px; display: inline-block; text-shadow: 0 0 10px ${isLow ? 'rgba(255,95,109,0.4)' : ACCENT_DIM};">${formatTime(remaining)}</span>
        `;
    }
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

initDemo();

function bootDemoTimer() {
    addPermanentTimer();
    if (isDemoExpired()) {
        showExpiredOverlay();
    } else {
        startExpirationChecker();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootDemoTimer);
} else {
    bootDemoTimer();
}
