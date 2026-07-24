
document.addEventListener('DOMContentLoaded', () => {
    // --- Helpers ---
    function showInfoToast(title, message) {
        const toast = document.createElement('div');
        toast.className = 'sim-toast info-toast tech-font';
        toast.innerHTML = `<strong>${title}</strong><br><span>${message}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('sim-toast-visible'), 50);
        setTimeout(() => { toast.classList.remove('sim-toast-visible'); setTimeout(() => toast.remove(), 400); }, 3200);
    }

    function shuffle(array) {
        let currentIndex = array.length,  randomIndex;
        while (currentIndex != 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    }

    function getTopCard(el) {
        if (!el || !el.dataset.cardData) return null;
        try {
            const data = JSON.parse(el.dataset.cardData);
            if (Array.isArray(data)) return data[data.length - 1];
            return data;
        } catch(e) { return null; }
    }

    function updateStackIndicator(slot) {
        if (!slot) return;
        
        // Remove existing dynamic elements
        slot.querySelectorAll('.pile-counter, .rarity-indicator, .pile-label').forEach(e => e.remove());
        
        const isHistory = slot.classList.contains('history-pile');
        const isFuture = slot.classList.contains('future-pile');
        
        let data = [];
        try {
            data = JSON.parse(slot.dataset.cardData || '[]');
            if (!Array.isArray(data)) data = data ? [data] : [];
        } catch(e) { data = []; }

        const count = data.length;

        // History changes can move creature stat buffs (Meridia's Artifact count,
        // Meridia's Cabin's top-of-History Artifact) — refresh this board's badges.
        if (isHistory) {
            const board = slot.closest('.player-zone');
            if (board) board.querySelectorAll('.creature-zone-main .card:not(.slot-empty)').forEach(s => updateCreatureVisuals(s));
        }

        // If empty, reset visuals completely
        if (count === 0) {
            slot.classList.add('slot-empty');
            slot.style.backgroundImage = '';
            slot.style.backgroundColor = '';
            slot.textContent = '';

            const label = document.createElement('div');
            label.className = 'pile-label tech-font';
            label.textContent = isHistory ? 'History' : 'Future';
            slot.appendChild(label);
            return;
        }

        // Has cards
        slot.classList.remove('slot-empty');
        slot.textContent = '';
        
        const counter = document.createElement('div');
        counter.className = 'pile-counter tech-font';
        counter.textContent = count;
        slot.appendChild(counter);

        if (isHistory) {
            const topCard = data[data.length - 1];
            const art = cardArtUrl(topCard);
            if (art) {
                slot.style.backgroundImage = `url('${art}')`;
            } else {
                slot.style.backgroundImage = '';
                slot.style.backgroundColor = 'rgba(255,255,255,0.1)';
                slot.textContent = topCard.name;
            }
        } else {
            // Future is face down
            slot.style.backgroundImage = "url('assets/card_back.png')";
        }
    }

    // --- Elements ---
    const cards = document.querySelectorAll('.card');
    const cardModal = document.getElementById('card-modal');
    const closeCardModalBtn = document.getElementById('close-modal');
    
    // Top Menu Elements
    const btnDatabase = document.getElementById('btn-database');
    const databaseScreen = document.getElementById('database-screen');
    const closeDatabaseBtn = document.getElementById('close-database');
    const databaseBody = document.getElementById('database-body');
    const gameView = document.getElementById('game-view');

    // Multiplayer State
    let activePlayerCount = 2;
    const gameField = document.getElementById('game-field');
    const playerBoardTemplate = document.getElementById('player-zone-template');
    const playerCountToggle = document.getElementById('player-count-toggle');
    
    // Keywords List Elements
    const btnRules = document.getElementById('btn-rules');
    const btnKeywords = document.getElementById('btn-keywords');
    const btnOptions = document.getElementById('btn-options');
    const btnDevlog = document.getElementById('btn-devlog');
    const keywordsListModal = document.getElementById('keywords-list-modal');
    const closeKeywordsListBtn = document.getElementById('close-keywords-list');
    const keywordsListContainer = document.getElementById('keywords-list-container');
    const devlogScreen = document.getElementById('devlog-screen');
    const closeDevlog = document.getElementById('close-devlog');
    const sortBtns = document.querySelectorAll('.sort-btn');
    const keywordSearch = document.getElementById('keyword-search');

    // Keyword Details Modal (Small)
    const keywordModal = document.getElementById('keyword-modal');
    const closeKeywordModalBtn = document.getElementById('close-keyword-modal');
    const keywordTitle = document.getElementById('keyword-title');
    const keywordDesc = document.getElementById('keyword-desc');

    // Card Sets toggle (inline in the Options modal)
    const setBtns = document.querySelectorAll('#sets-toggle .toggle-btn[data-set]:not(.disabled)');

    // Location Modal Elements
    const locationModal = document.getElementById('location-modal');
    const closeLocationModalBtn = document.getElementById('close-location-modal');
    const locationCardPreview = document.getElementById('location-card-preview');

    // Rules Modal Elements
    const rulesModal = document.getElementById('rules-modal');
    const closeRulesModalBtn = document.getElementById('close-rules-modal');
    const rulesBook = document.getElementById('rules-book');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');

    // Dice Elements

    // Quick Help Elements
    const btnHelp = document.getElementById('btn-help');
    const helpWindow = document.getElementById('quick-help-window');
    const helpTitle = document.getElementById('help-title');
    const helpDesc = document.getElementById('help-desc');

    // Options Modal Elements
    const optionsModal = document.getElementById('options-modal');
    const closeOptionsModalBtn = document.getElementById('close-options-modal');

    // Game Over Elements
    const gameOverOverlay = document.getElementById('game-over-overlay');
    const winnerTitle = gameOverOverlay ? gameOverOverlay.querySelector('.winner-title') : null;
    const btnPlayAgain = document.getElementById('btn-play-again');
    const btnBackMenu = document.getElementById('btn-back-menu');
    const btnStats = document.getElementById('btn-stats');
    const btnCloseOverlay = document.getElementById('btn-close-overlay');

    // Board Zones
    const landmarkZone = document.getElementById('landmark-zone');
    const creatureZone = document.getElementById('creature-zone');

    // --- Card Interaction State ---
    let devMode = false;
    let heldCards = [];
    let heldCardSources = [];
    let heldGhost = null;
    let hoverTimer = null;

    // --- Turn & Phase State ---
    let currentPlayer = 1;
    let currentPhase = 0; // 0: Steam, 1: Construction, 2: Creature, 3: End
    let turnSkipped = false;
    let steamBoughtThisTurn = false;
    let planetariumStaged = 0;          // cards discarded into the current Planetarium batch
    let planetariumUsedThisTurn = false; // Planetarium is once per Construction Phase
    let lethargoActive = false;          // Lethargo's Temple TP-buy mode is armed
    let lethargoOnlyTP = false;          // payment mode: false = Steam+TP, true = Only TP
    let lethargoUsedThisPhase = false;   // Temple is once per Construction Phase
    let lethargoViewedCard = null;       // card currently hovered while the Temple is armed
    let cloneFactoryArmed = false;       // Clone Factory: GoldSteam discarded, double-attack ready
    let cloneSecondStrikePending = false; // first strike resolved, attacker owed a second strike
    let cloneAttackerSlot = null;        // the creature slot mid double-attack
    let gameStarted = false;
    let gameWon = false;
    let activeStrDebuff = 0;
    let cellShieldDefender = null;       // Cell Shield (A4): player who armed it for the current attack
    let totalTurns = 0;
    const phases = ['Steam', 'Construction', 'Creature', 'End'];

    let currentAttackerCard = null;
    let currentAttackerSlot = null;

    document.getElementById('btn-attack-execute')?.addEventListener('click', executeAttack);
    document.getElementById('btn-attack-cancel')?.addEventListener('click', cancelAttack);

    // Dev Log and Dev Mode are disabled in the demo build.
    if (btnDevlog) {
        btnDevlog.onclick = () => {
            renderDevLog();
            renderChecklist();
            if (devlogScreen) devlogScreen.classList.remove('hidden');
        };
    }

    if (closeDevlog) {
        closeDevlog.onclick = () => {
            if (devlogScreen) devlogScreen.classList.add('hidden');
        };
    }

    // --- Dev Mode: disabled in the demo build (always off) ---
    const btnDevmode = document.getElementById('btn-devmode');
    function setDevMode(on) {
        devMode = false; // force-off in demo
        if (btnDevmode) btnDevmode.classList.toggle('devmode-active', devMode);
        document.body.classList.toggle('dev-mode-on', devMode);
    }

    const devlogTabs = document.querySelectorAll('.tab-btn');
    devlogTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            devlogTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const target = tab.dataset.tab;
            if (target === 'history') {
                document.getElementById('devlog-content').classList.remove('hidden');
                document.getElementById('devlog-checklist').classList.add('hidden');
            } else {
                document.getElementById('devlog-content').classList.add('hidden');
                document.getElementById('devlog-checklist').classList.remove('hidden');
            }
        });
    });

    const skipTurnBtn = document.getElementById('skip-turn-btn');
    if (skipTurnBtn) {
        skipTurnBtn.onclick = () => {
            if (currentPhase === 0) { // Only in Steam Phase
                turnSkipped = true;
                
                // --- Card Effect: Fountain of Youth ---
                const board = document.getElementById(`player-${currentPlayer}`);
                const landmarkSlots = Array.from(board.querySelectorAll('.landmark-zone-main .card:not(.slot-empty)'));
                const hasFountain = landmarkSlots.some(s => {
                    try {
                        return JSON.parse(s.dataset.cardData).name === 'Fountain of Youth';
                    } catch(e) { return false; }
                });

                if (hasFountain) {
                    // Lands on the active die (Day by default; Time Bender can switch it).
                    const targetDie = activeDieType(currentPlayer);
                    adjustPlayerDie(currentPlayer, targetDie, 1);

                    // Feedback: pulse the landmark and float "+1 TP" over the gaining die.
                    pulseLandmark(currentPlayer, 'Fountain of Youth');
                    const dieGroup = board.querySelector(
                        targetDie === 'day' ? '.day-die-group' : '.night-die-group'
                    );
                    floatValue(dieGroup, '+1 TP', 'gain');
                }

                currentPhase = 3;
                updatePhaseUI();
            }
        };
    }

    const implementedCards = ["Pandorama", "Fountain of Youth", "Laser Catalyst", "Dragura's Wasteland", "Planetarium", "Lethargo's Temple", "Clone Factory", "Aetherlab", "Entrophy", "Meridius", "Meridia", "Time Thief", "Ichor", "Vulcanem", "Cravus", "Rampadon", "Smoke", "Dark Matter", "Reflector", "Talisman", "Reversal", "Faith", "Threat", "Confiscation", "Gravitas", "Time Bender", "Meridia's Cabin", "Repo Station", "Hand of Rhone", "Atlantica", "Hyperscope", "Mines of Pyralos", "Chrona", "Razo", "Looper", "Masiota", "Aromeas", "General Wave", "Namandi", "Sea Lord", "Sleep Potion", "Lotus", "Rush", "Cell Shield", "Alchemy", "Tame Beast", "Tele Control", "Burden of Wealth"];

    // --- Intent Classification ---
    // auto: fires on its own when condition is met
    // contextual: fires when player performs the trigger action (if no ambiguity); falls back to active if conflict
    // active: player must explicitly click the card and confirm "Use Effect"
    const intentMap = {
        'Pandorama': 'auto',
        'Fountain of Youth': 'auto',
        "Dragura's Wasteland": 'contextual',
        'Planetarium': 'contextual',
        'Laser Catalyst': 'contextual',
        "Lethargo's Temple": 'active',
        'Clone Factory': 'active',
        'Aetherlab': 'active',
        'Ichor': 'auto',
        'Cravus': 'auto',
        'Entrophy': 'auto',
        'Meridius': 'auto',
        'Meridia': 'auto',
        'Time Thief': 'auto',
        'Rampadon': 'auto',
        'Vulcanem': 'auto',
        'Smoke': 'contextual',
        'Dark Matter': 'active',
        'Reflector': 'active',
        'Talisman': 'active',
        'Reversal': 'active',
        'Faith': 'active',
        'Threat': 'active',
        'Confiscation': 'active',
        'Gravitas': 'auto',
        'Time Bender': 'active',
        "Meridia's Cabin": 'auto',
        'Repo Station': 'contextual',
        'Hand of Rhone': 'active',
        'Atlantica': 'contextual',
        'Hyperscope': 'contextual',
        'Mines of Pyralos': 'active',
        'Chrona': 'active',
        'Razo': 'auto',
        'Looper': 'auto',
        'Masiota': 'contextual',
        'Aromeas': 'auto',
        'General Wave': 'auto',
        'Namandi': 'active',
        'Sea Lord': 'active',
        'Sleep Potion': 'active',
        'Lotus': 'active',
        'Rush': 'active',
        'Cell Shield': 'active',
        'Alchemy': 'active',
        'Tame Beast': 'active',
        'Tele Control': 'active',
        'Burden of Wealth': 'active',
    };

    // --- Simulation Presets ---
    // Each entry describes the board state to load for quick effect testing.
    // hand/p2hand: card names; landmarks/p2landmarks: card names; p1creatures/p2creatures: {name, damageTaken}
    // p1history: card names to put in Player 1's History Pile
    const simulationMap = {
        'Pandorama': {
            phase: 0,
            desc: "Pandorama active. Hand limit should be 7 instead of 5.",
            landmarks: ['Pandorama'],
        },
        'Fountain of Youth': {
            phase: 0,
            desc: "Fountain of Youth active. Press Skip Turn — should gain +1 TP.",
            landmarks: ['Fountain of Youth'],
        },
        "Dragura's Wasteland": {
            phase: 1,
            desc: "Vulcanem has taken 2 damage (shows as 4). FireSteam in hand. Use Wasteland to heal all damage.",
            hand: ['FireSteam'],
            landmarks: ["Dragura's Wasteland"],
            p1creatures: [{ name: 'Vulcanem', damageTaken: 2 }],
        },
        'Laser Catalyst': {
            phase: 3,
            desc: "Laser Catalyst in Landmark Zone, 2 LaserSteams in hand. End Phase — activate to deal 2 damage.",
            hand: ['LaserSteam', 'LaserSteam'],
            landmarks: ['Laser Catalyst'],
        },
        'Planetarium': {
            phase: 1,
            desc: "Planetarium in play, 4 cards in Future. Construction Phase: discard cards to History (landmark glows 'Draw N'), then click Planetarium to draw that many.",
            hand: ['FireSteam', 'GoldSteam', 'LaserSteam'],
            landmarks: ['Planetarium'],
            p1future: ['Ichor', 'Cravus', 'Vulcanem', 'Rampadon'],
        },
        "Lethargo's Temple": {
            phase: 1,
            day: 10,
            desc: "Lethargo's Temple active, 10 TP. Bazaar should highlight cards affordable by TP (F=1, G=2, L=3).",
            landmarks: ["Lethargo's Temple"],
        },
        'Clone Factory': {
            phase: 2,
            desc: "Rampadon in Creature Zone, GoldSteam in hand. Clone Factory should allow attacking twice.",
            hand: ['GoldSteam'],
            landmarks: ['Clone Factory'],
            p1creatures: [{ name: 'Rampadon', damageTaken: 0 }],
        },
        'Aetherlab': {
            phase: 1,
            desc: "Aetherlab in play, FireSteam + GoldSteam in hand. Method A: click Aetherlab, then a glowing Steam. Method B: drag a Steam onto its own/next drawer above the Bazaar.",
            hand: ['FireSteam', 'GoldSteam'],
            landmarks: ['Aetherlab'],
        },
        'Cravus': {
            phase: 2,
            desc: "Cravus summoned this turn (summonedOnTurn = totalTurns). Should still be attackable — no summoning sickness.",
            p1creatures: [{ name: 'Cravus', damageTaken: 0, forceThisTurn: true }],
        },
        'Entrophy': {
            phase: 2,
            desc: "Entrophy in Creature Zone. Attack to trigger the die roll — 6 possible outcomes.",
            p1creatures: [{ name: 'Entrophy', damageTaken: 0 }],
        },
        'Meridius': {
            phase: 2,
            desc: "Meridius in Creature Zone. Player 2 has 3 Landmarks — Meridius should have +3 Str and be unblockable.",
            p1creatures: [{ name: 'Meridius', damageTaken: 0 }],
            p2landmarks: ['Pandorama', 'Clone Factory', 'Aetherlab'],
        },
        'Meridia': {
            phase: 2,
            desc: "Meridia in Creature Zone, 2 Artifacts in History. HP should show as 2 (0 base + 2 artifact bonus).",
            p1creatures: [{ name: 'Meridia', damageTaken: 0 }],
            p1history: ['Smoke', 'Dark Matter'],
        },
        'Time Thief': {
            phase: 2,
            desc: "Time Thief (3 HP) in Creature Zone. Attack directly — should gain 3 TP.",
            p1creatures: [{ name: 'Time Thief', damageTaken: 0 }],
        },
        'Rampadon': {
            phase: 2,
            desc: "Rampadon in Creature Zone. Attack — should be unblockable and instant.",
            p1creatures: [{ name: 'Rampadon', damageTaken: 0 }],
        },
        'Smoke': {
            phase: 2,
            desc: "Ichor attacking from Player 1. Smoke in Player 2's hand — use it in defense to reduce attacker Str by 1.",
            p1creatures: [{ name: 'Ichor', damageTaken: 0 }],
            p2hand: ['Smoke'],
        },
        'Dark Matter': {
            phase: 1,
            desc: "Dark Matter in hand with full payment (F+G+L). Play it — draw a card and force opponent choice.",
            hand: ['FireSteam', 'GoldSteam', 'LaserSteam', 'Dark Matter'],
        },
        'Reflector': {
            phase: 2,
            desc: "Ichor attacking from Player 1. Reflector in Player 2's hand — play it in defense to redirect the attack back onto Player 1.",
            p1creatures: [{ name: 'Ichor', damageTaken: 0 }],
            p2hand: ['Reflector'],
        },
        'Talisman': {
            phase: 2,
            desc: "Ichor attacking from Player 1, Talisman in Player 1's hand, Reflector in Player 2's hand. Attack, let Player 2 play Reflector — Player 1 gets a Talisman prompt to prevent the redirect.",
            hand: ['Talisman'],
            p1creatures: [{ name: 'Ichor', damageTaken: 0 }],
            p2hand: ['Reflector'],
        },
        'Reversal': {
            phase: 1,
            desc: "Reversal in hand (F+G+G). Ichor and Smoke in History Pile. Play to take one back.",
            hand: ['FireSteam', 'GoldSteam', 'GoldSteam', 'Reversal'],
            p1history: ['Ichor', 'Smoke'],
        },
        'Faith': {
            phase: 1,
            desc: "Faith in hand with full payment (G+G+G). Play to draw a card and gain 3 TP.",
            hand: ['GoldSteam', 'GoldSteam', 'GoldSteam', 'Faith'],
        },
        'Threat': {
            phase: 1,
            desc: "Threat (F+G+L) in Bazaar S3 (buy it there to test). Player 1 has 1 Landmark, Player 2 has 2 — pick either board's Landmark, including your own.",
            hand: ['FireSteam', 'GoldSteam', 'LaserSteam'],
            landmarks: ['Fountain of Youth'],
            p2landmarks: ['Pandorama', 'Clone Factory'],
        },
        'Alchemy': {
            phase: 1,
            desc: "Alchemy (F+G+G+G) in Bazaar S1 (buy it there to test). Player 1 has 1 Landmark, Player 2 has 2 — pick either player to discard ALL their Landmarks to their History (they cycle back on a later draw).",
            hand: ['FireSteam', 'GoldSteam', 'GoldSteam', 'GoldSteam'],
            landmarks: ['Fountain of Youth'],
            p2landmarks: ['Pandorama', 'Clone Factory'],
        },
        'Tame Beast': {
            phase: 1,
            day: 6,
            desc: "Tame Beast (G+G+G) in Bazaar S2 (Duality set active — buy it there). Player 1 has an Ichor (2 HP), Player 2 a Sea Lord (6 HP). Pick either Creature — it drops to 1 HP and you gain the removed HP as Time Points (Sea Lord 6→1 = +5 TP; your Day die starts at 6).",
            hand: ['GoldSteam', 'GoldSteam', 'GoldSteam'],
            p1creatures: [{ name: 'Ichor', damageTaken: 0 }],
            p2creatures: [{ name: 'Sea Lord', damageTaken: 0 }],
        },
        'Tele Control': {
            phase: 1,
            desc: "Tele Control (F+G+L) in Bazaar S3 (Duality set active — buy it there). Player 1 has an Ichor, Player 2 a Sea Lord (Str 6), both active. Pick either Creature, then a target Player: commandeer P2's Sea Lord and aim it at Player 2 to smash them for 6 with their own Creature — and it stays in P2's zone (not discarded).",
            hand: ['FireSteam', 'GoldSteam', 'LaserSteam'],
            p1creatures: [{ name: 'Ichor', damageTaken: 0 }],
            p2creatures: [{ name: 'Sea Lord', damageTaken: 0 }],
        },
        'Burden of Wealth': {
            phase: 1,
            desc: "Burden of Wealth (G+G+L+L) in Bazaar S4 (Duality set active — buy it there). Player 2 holds 5 Cards (Sea Lord, LaserSteam, GoldSteam, Cravus, FireSteam) → 5 damage. P2 may discard their most expensive Cards (Sea Lord first, then LaserSteam > GoldSteam > Cravus > FireSteam) to cut it 1-per-Card.",
            hand: ['GoldSteam', 'GoldSteam', 'LaserSteam', 'LaserSteam'],
            p2hand: ['Sea Lord', 'LaserSteam', 'GoldSteam', 'Cravus', 'FireSteam'],
        },
        'Confiscation': {
            phase: 1,
            desc: "Confiscation (G+G+L+L) in Bazaar S4 (buy it there to test). Player 2 has 3 cards — look at hand, take one.",
            hand: ['GoldSteam', 'GoldSteam', 'LaserSteam', 'LaserSteam'],
            p2hand: ['Ichor', 'Cravus', 'Smoke'],
        },
        'Gravitas': {
            phase: 3,
            desc: "Gravitas in play, 1 card in hand, 1 in Future, 6 in History. End Phase draws 2 — the reshuffle fires Gravitas, refilling your hand to the limit (5).",
            hand: ['FireSteam'],
            landmarks: ['Gravitas'],
            p1future: ['GoldSteam'],
            p1history: ['Ichor', 'Cravus', 'Smoke', 'FireSteam', 'GoldSteam', 'LaserSteam'],
        },
        'Time Bender': {
            phase: 1,
            day: 10,
            night: 8,
            desc: "Time Bender in play (Day 10, Night 8). Click it to make Night your active die (marker ring appears), then play Faith from hand — the +3 TP lands on the Night die.",
            hand: ['GoldSteam', 'GoldSteam', 'GoldSteam', 'Faith'],
            landmarks: ['Time Bender'],
        },
        "Meridia's Cabin": {
            phase: 1,
            desc: "Cabin in play, Smoke (Artifact) on top of History, Ichor in zone — badge should show 3 (2+1). Discard a Steam onto History (covering Smoke) and the buff drops off.",
            hand: ['FireSteam'],
            landmarks: ["Meridia's Cabin"],
            p1creatures: [{ name: 'Ichor', damageTaken: 0 }],
            p1history: ['GoldSteam', 'Smoke'],
        },
        'Repo Station': {
            phase: 2,
            day: 10,
            desc: "Repo Station in play, Cravus + Vulcanem in zone, P2 has a weakened Ichor blocker. Attack and defeat it for +1 TP, or click the Station and pick one of your own to sacrifice for +1 TP.",
            landmarks: ['Repo Station'],
            p1creatures: [{ name: 'Cravus', damageTaken: 0 }, { name: 'Vulcanem', damageTaken: 0 }],
            p2creatures: [{ name: 'Ichor', damageTaken: 1 }],
        },
        'Hand of Rhone': {
            phase: 1,
            day: 9,
            rhoneCharge: 5,
            desc: "Hand of Rhone at full charge (5 + auto +1 on entering Construction = 6 Force). Click it and Release: the Force alternates ×6 — Opponent -3 TP, You +3 TP (full-charge heal).",
            landmarks: ['Hand of Rhone'],
        },
        'Atlantica': {
            phase: 1,
            desc: "Atlantica + Pandorama in play — the extended-hand row appears below the Landmark Zone. Park a card behind each active Landmark (1 each, doesn't count against Hand Limit); parked Steam still pays for buys. Dev-Mode double-click Pandorama: its parked card is discarded.",
            hand: ['FireSteam', 'GoldSteam', 'LaserSteam'],
            landmarks: ['Atlantica', 'Pandorama'],
        },
        'Hyperscope': {
            phase: 2,
            desc: "Hyperscope in play, Cravus + Vulcanem ready. Attack: the opponent's Ichor and Landmarks glow as direct targets (plus a Strike-Player button). Pandorama (Price 2) falls to one Cravus hit; Gravitas (Price 3) needs 3+ attack damage in one turn. No block choice for the defender.",
            landmarks: ['Hyperscope'],
            p1creatures: [{ name: 'Cravus', damageTaken: 0 }, { name: 'Vulcanem', damageTaken: 0 }],
            p2landmarks: ['Pandorama', 'Gravitas'],
            p2creatures: [{ name: 'Ichor', damageTaken: 0 }],
        },
        'Mines of Pyralos': {
            phase: 1,
            desc: "Mines in play, 2 cards in hand, 7 in your Future, 2 in the opponent's. Click the Mines: send a card into the Abyss, pick either Future Pile, rearrange its top 6 (leftmost = drawn next), then draw 1 — set up your own next draw.",
            hand: ['FireSteam', 'GoldSteam'],
            landmarks: ['Mines of Pyralos'],
            p1future: ['Ichor', 'Cravus', 'Smoke', 'FireSteam', 'GoldSteam', 'LaserSteam', 'Vulcanem'],
            p2future: ['Rampadon', 'FireSteam'],
        },
        'Chrona': {
            phase: 2,
            desc: "Chrona just summoned — the split window is open. Click it to redistribute its 4 Health Points: 1⚔/3⛨ → 2/2 → 3⚔/1⛨ (wrapping, never 0). Next turn the split locks in and it attacks/blocks with the chosen values.",
            p1creatures: [{ name: 'Chrona', damageTaken: 0, forceThisTurn: true }],
        },
        'Razo': {
            phase: 2,
            desc: "Razo + Ichor in your zone. Turn on Dev Mode and double-click each: Ichor flips face down, Razo refuses — he can never be deactivated (Sleep Potion will bounce off him the same way).",
            p1creatures: [{ name: 'Razo', damageTaken: 0 }, { name: 'Ichor', damageTaken: 0 }],
        },
        'Looper': {
            phase: 2,
            desc: "Looper in your zone, opponent has an Ichor blocker and Smoke in hand. Attack: the Futory Die rolls the number of strikes — re-pick the target each strike, defender may block each one separately. Only the FIRST strike allows Artifact responses and carries buffs/debuffs; later strikes are plain Strength-1 hits.",
            p1creatures: [{ name: 'Looper', damageTaken: 0 }],
            p2creatures: [{ name: 'Ichor', damageTaken: 0 }],
            p2hand: ['Smoke'],
        },
        'Masiota': {
            phase: 2,
            desc: "Masiota (3 HP) in your zone, opponent blocks with Razo (3 HP). Attack into the mutual destruction: the rescue offer flips Masiota face down instead of discarding. Next turn, click him to reactivate at 2 HP (-1 per rescue; same-turn reactivation is refused). Two rescues max — a third would bring him back at 0.",
            p1creatures: [{ name: 'Masiota', damageTaken: 0 }],
            p2creatures: [{ name: 'Razo', damageTaken: 0 }],
        },
        'Aromeas': {
            phase: 2,
            day: 9,
            desc: "Your active Day die is at 9 TP. Aromeas is already in the Creature Zone — his HP was fixed on entry to half of 9, ROUNDED UP = 5 (badge shows 5). The value is locked at entry: it does not track the die if the 9 changes later.",
            p1creatures: [{ name: 'Aromeas', damageTaken: 0, forceThisTurn: true }],
        },
        'Namandi': {
            phase: 2,
            desc: "Namandi (base Strength 3) in your zone; hand holds Smoke + Ichor (Non-Steam, eligible) and a FireSteam (Steam, NOT eligible). Attack: the eligible cards pulse red — click to select (gold), each discard = +1 Strength. Selecting both makes him strike for 5, this attack only; the discarded cards go to your History.",
            p1creatures: [{ name: 'Namandi', damageTaken: 0 }],
            hand: ['Smoke', 'Ichor', 'FireSteam'],
        },
        'Sea Lord': {
            phase: 2,
            desc: "Sea Lord (Strength 6) ready in your zone; History holds Smoke + Ichor, Future holds 2 Steam. Attack: after he strikes and is discarded to History, a prompt offers to fold your History + Future into one fresh shuffled Future Pile (Sea Lord cycles back in too) — History empties and Future holds all of them.",
            p1creatures: [{ name: 'Sea Lord', damageTaken: 0 }],
            p1history: ['Smoke', 'Ichor'],
            p1future: ['FireSteam', 'GoldSteam'],
        },
        'Sleep Potion': {
            phase: 1,
            desc: "Two Sleep Potions in hand (Construction Phase). Click one → cyan targets glow on both boards. Deactivate the opponent's Ichor (it flips face down); play the second potion on the sleeping Ichor to DISCARD it. Deactivating your own Cravus makes it a secret (opponent can't peek). The opponent's Pandorama can be put to sleep too.",
            hand: ['Sleep Potion', 'Sleep Potion'],
            p1creatures: [{ name: 'Cravus', damageTaken: 0 }],
            p2creatures: [{ name: 'Ichor', damageTaken: 0 }],
            p2landmarks: ['Pandorama'],
        },
        'Cell Shield': {
            phase: 2,
            desc: "Ichor (Strength 2) attacking from Player 1; Cell Shield in Player 2's hand. On defense, open PLAY ARTIFACT and play Cell Shield — the 2 Time Points the strike would cost are fully prevented (Day stays 12) and Player 2 draws 2 Cards instead.",
            p1creatures: [{ name: 'Ichor', damageTaken: 0 }],
            p2hand: ['Cell Shield'],
        },
        'Rush': {
            phase: 2,
            desc: "Creature Phase: Ichor was just summoned, so clicking it says 'Summoning sickness!'. Play Rush from hand → with one Creature it applies automatically, stamps Ichor attack-ready, and opens the ATTACK menu so the strike lands this turn. Rush goes to your History.",
            hand: ['Rush'],
            p1creatures: [{ name: 'Ichor', damageTaken: 0, forceThisTurn: true }],
        },
        'Lotus': {
            phase: 1,
            desc: "Construction Phase, hand holds a Lotus + two Cravus, Repo Station in play. Click Lotus → it lays a pad beside the middle (order 1,3,0,4). Advance to the Creature Phase, then click a Cravus → it summons to the MIDDLE slot; click the second Cravus → it seats on the Lotus pad (🪷 marker). The Lotus rides with that Creature — sacrifice it via Repo Station (or defeat it) and Lotus goes to History too; a plain attack leaves the empty pad behind.",
            hand: ['Lotus', 'Cravus', 'Cravus'],
            landmarks: ['Repo Station'],
        },
    };

    const devLogData = [
        { date: '2026-07-24', msg: "System — Computer opponent is now the DEFAULT in both the full version and the Demo: vsComputer starts true, the Options toggle shows Computer active (difficulty row + AI feed visible on first load), and the localStorage preference now round-trips an explicit Human choice (typeof check instead of truthy) so picking Human still sticks across sessions. Also rewrote the Rules book from the 2-placeholder-page stub into the full QUICK START RULES booklet, extracted from assets/QuickStartRulesWeb.pdf and restyled in-game (Cinzel headings, Rajdhani body, kickers, page numbers, Steam/Day/Night color accents, color-coded purchase-destination rows): 12 pages — The Story, Card Elements, Setup (Bazaar + Deck), Time Points, Future & History, Buying Cards, Card Types, Creatures & Combat, Phases 1–4 with Skip Turn, and Destiny Cards. Fixed a latent book bug along the way: updateBook() was never called on load, so the BACK cover rendered on top by DOM order — it now runs once at init and resets to the cover each time the Rules modal opens. Verified live in both builds: fresh localStorage boots with Computer active and the AI feed shown, all 14 book pages flip in order with zero page overflow, no console errors." },
        { date: '2026-07-10', msg: "Burden of Wealth (Duality S4) — implemented (active), completing all FOUR Duality Sparks (and the whole Duality Bazaar): 'Target damage to a Player equal to the Cards in their Hand. They may reduce damage by discarding Cards, from most expensive to least.' resolveBurden() offers a player picker (all seats, self included — 'a Player', faithful) with each seat's live Hand count. beginBurden() sorts the target's Hand most-expensive-first and sets damage = Hand size N. The expensiveness comparator burdenExpensiveness() encodes the PRINTED rule — FIRST total Steams used (a Card's Bazaar-cost pip count), THEN Steam value (Laser > Gold > Fire > AllSteam): so FFL > GGG (equal count, Laser outranks Gold) and FFF > GL (3 pips beat 2, count dominates). This is deliberately the OPPOSITE priority to the existing cardCostValue() auto-discard heuristic (where tier dominates count), so Burden gets its own comparator; Steam Cards rank by their own printed Bazaar cost (LaserSteam 'FGG' > GoldSteam 'AAA' > FireSteam '-'), landing them in a sensible order with zero special-casing. The target then chooses how many of their TOP Cards to shed (each −1 damage) — promptBurdenDiscard() shows a glass overlay listing the Hand in expensiveness order as clickable chips (click a chip to discard the whole prefix through it, click the current boundary to step back one), with the selected Cards struck through red and a live 'Discard k → Take N−k damage' readout; most-expensive-first is enforced by construction (you can only take the top k). applyBurden() discards the k Cards to the target's OWN History and deals the remaining N−k through the standard resolveDamageDirectly (active die first). The Computer decides for itself when targeted (aiHoards: keep all Cards unless the hit is lethal, in which case shed just enough of its most expensive to survive). Sim preset (Duality active; P2 holds Sea Lord/LaserSteam/GoldSteam/Cravus/FireSteam = 5 damage). Verified live: buying from S4 spent GGLL → Abyss, picker read '0 Cards' / '5 Cards'; targeting P2 opened the stepper with chips ordered EXACTLY Sea Lord (GGGLL) > LaserSteam (FGG) > GoldSteam (AAA) > Cravus (GG) > FireSteam; discarding the top 3 sent Sea Lord/LaserSteam/GoldSteam to P2's History, left Cravus + FireSteam, and dealt 2 (P2 Day 12→10); a re-run confirming 0 discards took the full 5 with the Hand intact. No console errors. NOTE FOR SIMON: expensiveness is read off each Card's Bazaar cost pips (so a LaserSteam, cost FGG, outranks a GoldSteam, cost AAA) — tell me if you'd rather a Steam Card rank by its own emitted Steam (its type) instead of its purchase cost." },
        { date: '2026-07-10', msg: "Tele Control (Duality S3) — implemented (active): 'Use an active Creature to attack a Player of your choice. The controlled Creature is not discarded.' Registered in sparkEffects (buy-and-play path). resolveTeleControl() gathers every ACTIVE Creature on BOTH boards — face-up and able to act, using the same canAct rule the attack flow/AI use (summonedOnTurn < totalTurns, or Cravus/Rampadon), so an opponent's Creature always qualifies on your turn — the whole point of the card is to commandeer their Creature and turn it on them. With one it auto-advances; with several it pulses each red behind a 'TELE CONTROL — CHOOSE A CREATURE TO COMMAND' bar (capture-click, no CANCEL — a Spark is committed). chooseTeleControlTarget() then offers EVERY seat as the strike target ('a Player of your choice' is literal, self included). launchTeleControlAttack() runs the strike through the NORMAL pipeline — beginAttack (Entrophy/Meridius scaling intact) → defense screen, so the target can still block and respond with Artifacts — tagged { ...card, teleControlled:true }. Two engine hooks make it correct: (1) finishAttacker short-circuits at the top when teleControlled && !defeated — the Creature stays in its owner's zone instead of being spent to History (only a genuine mutual-destruction defeat, which really hit 0 HP, still discards it — JUDGMENT CALL); (2) initiateDefense now filters the attacker slot out of the blocker list (a Creature can never block itself — matters when you aim a commandeered Creature back at its own owner, who might otherwise be offered it as a blocker; a harmless no-op in normal cross-board combat). Sim preset (Duality active; P1 Ichor, P2 Sea Lord Str 6, both active). Verified live BOTH directions: buying Tele Control from S3 spent FGL, sent it to the Abyss and pulsed both creatures; commandeering P2's OWN Sea Lord and aiming it at Player 2 struck for 6 (P2 Day 12→6, block disabled since its only Creature was the attacker), and the Sea Lord STAYED in P2's zone with P2's History empty; a re-run commandeering your own Ichor vs P2 left P2 able to block with Sea Lord, resolved a direct strike for 2, and the Ichor stayed in P1's zone (History held only the FGL payment, no Ichor). No console errors. V1: the Computer doesn't buy Sparks, so it never casts Tele Control (its Creatures are valid targets). NOTE FOR SIMON: 'not discarded' is read as surviving the normal after-attack spend; a controlled Creature that dies in mutual destruction still goes to History. Tell me if it should be immune to that too." },
        { date: '2026-07-10', msg: "Tame Beast (Duality S2) — implemented (active): 'Reduce the Health Points of any Creature in play to 1 and gain the deduced Time Points.' Registered in sparkEffects, so it rides the buy-and-play Spark path (click Bazaar tile → pay GGG → resolve → Abyss). resolveTameBeast() gathers every FACE-UP Creature in either Creature Zone (face-down ones are excluded — their stats are a mystery, same rule as Hyperscope aiming); with one it auto-applies, with several it pulses each with the red threat-target glow behind a docked 'TAME BEAST — CHOOSE ANY CREATURE' bar and a capture-click picks (the Sleep Potion / Repo Station picker pattern; no CANCEL — a Spark is committed once bought, like Threat). applyTameBeast() reads the Creature's current effective HP — base (baseResistance ?? baseHealth) + Cabin/Meridia buffs − damage already taken — and JUDGMENT CALL applies the reduction AS DAMAGE (card.damageTaken += HP−1): the engine's single-HP model, so it drops attack Strength and block Resistance together, the stat badge repaints to 1 via updateCreatureVisuals, and (like any damage) a Fountain-of-Youth heal could restore it. The caster then gains TP equal to the HP removed (oldHP − 1) through gainTimePoints (respects the 12 cap and the active die). Cross-board by design — you may tame your OWN Creature too (e.g. to cash a big body for TP). Sim preset (Duality active; P1 Ichor 2 HP, P2 Sea Lord 6 HP, P1 Day pinned to 6). Verified live both targets: buying Tame Beast from S2 spent GGG, sent it to the Abyss and pulsed BOTH creatures behind the bar; taming P2's Sea Lord set its damageTaken 0→5, badge → 1, and P1's Day die 6→11 (+5 TP); a re-run taming your own Ichor set damageTaken 1, badge → 1, Day 6→7 (+1 TP) with the Sea Lord untouched. No console errors. V1: the Computer doesn't buy Sparks, so it never casts Tame Beast (its Creatures are valid targets). NOTE FOR SIMON: 'reduce to 1' is modeled as damage (healable) rather than a hard stat rewrite — tell me if a tamed Creature should stay at 1 HP permanently even through a heal." },
        { date: '2026-07-10', msg: "Alchemy (Duality S1) — implemented (active), the first Duality Spark: 'A Player of your choice has to discard all Cards from their Landmark Zone.' Registered in the sparkEffects table next to Reversal/Faith/Threat/Confiscation, so it rides the existing buy-and-play-a-Spark path (click its Bazaar tile → pay cost → resolveSparkEffect → Abyss) with zero new plumbing. resolveAlchemy() differs from Confiscation/Dark Matter in one deliberate way: 'a Player of YOUR CHOICE' INCLUDES yourself, so the picker (same landmark-choice-overlay styling as Reversal's) offers EVERY seat — 'Player 1 (You) — N Landmarks' and 'Player 2 — N Landmarks' — with a live count, letting you torch your own Landmarks on purpose or pick a player who owns none (a legal, empty choice); it always asks rather than auto-resolving. discardAllLandmarks(owner) then sends every occupied Landmark-Zone card to that owner's OWN History Pile — JUDGMENT CALL on 'discard': the game's discard destination is History (Threat's explicit 'to the Abyss' is the exception, not the rule), so, exactly like a Hyperscope-destroyed Landmark, each discarded Landmark cycles and rebuilds itself on a later draw — Alchemy is a tempo swing, not permanent removal. Because it routes through the shared clearSlot chokepoint, Atlantica parked cards and Hand of Rhone charges tear down with their Landmark automatically; Atlantica 'cannot be deactivated' but IS discardable, so it goes too. V1: the Computer doesn't buy Sparks, so it never casts Alchemy (but is a valid target). Sim preset (P1: Fountain of Youth; P2: Pandorama + Clone Factory; hand F+G+G+G to buy from Bazaar S1 — Duality set active). Verified live both target paths: buying Alchemy spent FGGG, sent it to the Abyss and opened the picker reading exactly '1 Landmark' / '2 Landmarks'; picking Player 2 discarded BOTH Pandorama and Clone Factory to P2's History and emptied their Landmark Zone with P1's Fountain untouched; a re-run picking Player 1 (You) discarded Fountain of Youth to P1's own History with P2 untouched. No console errors. NOTE FOR SIMON: I read 'discard' as → History (cards cycle back on a later draw). Tell me if Alchemy should instead send Landmarks to the Abyss (permanent removal, like Threat)." },
        { date: '2026-07-09', msg: "Cell Shield (Duality A4) — implemented (active), completing all FOUR Duality Artifacts (I had miscounted A1-A3 and missed this one). 'When you're being attacked: Prevent all Time Points that you would lose from an attack and draw Cards equal to that amount.' It's a defensive response, so it rides the existing PLAY ARTIFACT step of the defense screen next to Smoke/Reflector/Talisman (any Artifact in the defender's hand already surfaces there — no new UI). Selecting it in the artifact-CONFIRM loop arms one module flag, cellShieldDefender = defenderNum; the effect then resolves at damage time via maybeCellShield(amount, defenderNum), guarded into all three attack→player damage sites (unblocked direct strike in resolveDamageDirect, blocked spillover in resolveCombat, and the no-blocker fallback in resolveBlock): when armed for that defender it prevents the hit entirely (the caller skips resolveDamageDirectly) and instead draws that many Cards. JUDGMENT CALL: 'Time Points you would lose' is capped at the Time Points you actually hold — Math.min(damage, totalTimePoints) — so a lethal-looking overkill only draws up to your remaining TP; tell me if you'd rather draw the raw attack amount. The flag is one-attack-only (cleared on use, in finishAttacker's terminal path so a repelled attack can't leak it, and in the per-turn reset). Because Cell Shield fully prevents, blocking is optional — playing it and taking the hit draws the full Strength. V1: the Computer doesn't play defensive Artifacts, so it never uses Cell Shield (it remains a valid target of nothing — it's the human's tool); Time Thief still gains his TP since the damage was 'dealt' before being prevented (Meridia precedent). Sim preset (Ichor Str 2 from P1, Cell Shield in P2's hand). Verified live hot-seat: P2 opened PLAY ARTIFACT, played Cell Shield (→ P2 History), took the strike, and the feedback read 'Cell Shield! 2 Time Points prevented — draw 2' — P2's Day stayed 12 (nothing lost), P2's Future dropped 5→3 as it drew FireSteam + Ichor into hand, and Ichor spent to P1's History as normal. No console errors." },
        { date: '2026-07-09', msg: "Rush (Duality A3) — implemented (active): 'In your Creature Phase: Make a Creature attack instantly.' Played from hand (a name branch in the hand-click dispatcher, gated to phase 2). triggerRush() collects your face-up zone Creatures; with one it applies automatically, with several it pulses them (red threat-target) behind a docked CHOOSE A CREATURE / CANCEL bar (the Repo Station / Sleep Potion picker pattern, capture-click to preempt the normal attack click). Applying spends Rush to your History (Artifacts return to History after use) and calls rushCreature(): it stamps the chosen Creature's summonedOnTurn to 0 so the summoning-sickness gate is bypassed for the rest of the turn (a cancelled attack can still be retried by clicking the Creature), then opens the standard ATTACK menu via showAttackMenu — so the whole existing attack pipeline (Entrophy/Looper/Namandi/Hyperscope, targeting, defense) runs unchanged. CANCEL leaves Rush in hand; no Creature in play alerts and spends nothing. V1: the Computer doesn't buy Artifacts, so it never plays Rush. Sim preset (Creature Phase: a just-summoned, summoning-sick Ichor + Rush in hand). Verified live: clicking Ichor first alerted 'Summoning sickness!'; playing Rush auto-applied (one Creature), stamped Ichor summonedOnTurn 0, sent Rush to History and opened the ATTACK menu; ATTACK then struck P2 directly for 2 (Day 12→10) and Ichor moved to History (History = Rush, Ichor). No console errors." },
        { date: '2026-07-09', msg: "Lotus (Duality A2) — implemented (active), per Simon's placement rulings. This also formalized the Creature-Zone geometry: the MIDDLE slot (index 2) is the only default Creature field, and Creatures are now CLICK-SUMMONED (click one in your Creature Phase → it lands in the middle) rather than dragged — the drag highlight for Creatures is likewise narrowed to the middle slot. Lotus is played by clicking it in your Construction Phase: placeLotusPad() lays it as a face-up Artifact pad in the first open slot in Simon's order [1,3,0,4] (left-adjacent, right-adjacent, outer-left, outer-right). An unoccupied pad already counts as an Artifact-in-zone for Meridia's Cabin (cabinBonus was pre-wired for exactly this). Summoning onto a pad: when the middle is taken, summonCreatureToZone() seats the additional Creature ON the first open Lotus pad, stacking it as a full Creature (baseStrength/badges/attack/block all normal — Simon: 'a fully functional second attacker AND blocker') with the Lotus riding along on card.lotusPad and a 🪷 corner marker. Fate-binding rides two hooks: the History write inside finishSingleCardPlacement discharges the Lotus alongside the Creature whenever a lotus-borne Creature is removed to History (covers Repo Station / Dark Matter sacrifice and every combat defeat in one chokepoint — the Creature and its Lotus both land in the owner's History, marker stripped so a redraw is clean); and finishAttacker special-cases the spent-after-attack path — JUDGMENT CALL per the literal card text ('when the Creature is defeated or sacrificed'): a Creature that merely ATTACKS and is spent leaves its Lotus pad BEHIND (empty, reusable next turn), so finishAttacker re-seats the pad and strips the marker, while a mutually-destroyed attacker (new attackerDefeated flag from resolveCombat) keeps the rider so the Lotus discharges. A creature-stat init guard (type === 'Creature') keeps a Lotus laid in the zone from picking up combat stats. V1: the Computer doesn't buy Artifacts, so it neither plays Lotus nor summons onto one. Sim preset (Construction Phase: Lotus + two Cravus in hand, Repo Station in play). Verified live all four paths: clicking Lotus laid a pad in slot 1 (Artifact, no stat pollution); advancing to the Creature Phase, clicking the first Cravus summoned it to the middle and the second seated on the pad with the 🪷 marker (onLotus, baseStrength 2); Repo-Station-sacrificing the Lotus Cravus sent BOTH Cravus and Lotus to History with the pad cleared; and in a re-run, ATTACKING with the Lotus Cravus struck P2 for 2 (Day 12→10), sent only the Cravus to History (no rider), and LEFT the empty Lotus pad in slot 1. No console errors. NOTE FOR SIMON: I read 'defeated or sacrificed' literally, so Lotus survives a plain attack and is reusable — tell me if instead the Lotus should discard whenever its Creature leaves the zone for any reason (including after attacking)." },
        { date: '2026-07-09', msg: "Sleep Potion (Duality A1) — implemented (active), the deactivator the whole face-down subsystem was built for, per Simon's confirmed design: 'In your Construction or Creature Phase, deactivate a Creature or Landmark of your choice; targeting an already face-down card discards it instead; you may deactivate your own Creature to keep it anonymous.' Played from the hand like Dark Matter (a name branch in the hand-click dispatcher, legal in phase 1 OR 2). triggerSleepPotion() gathers every Creature and Landmark on BOTH boards that is either already asleep (→ discard) or canBeDeactivated() (so face-up Atlantica/Razo are never offered, but an already-deactivated card always is), pulses them with a new cyan .sleep-target glow plus a docked CHOOSE A CREATURE OR LANDMARK / CANCEL bar (same picker pattern as Threat/Mines, capture-click to preempt the card's normal handler). resolveSleepPotion() branches on the target's state: a face-up target flips card.deactivated = true through the existing subsystem (syncFaceDownVisual + refreshBoardAfterDeactivation, so Cabin badges, hand limit and Atlantica parked-card cleanup all re-sync), and if it's YOUR OWN Creature it also gets faceDownSecret so the opponent can't peek it (anonymity); an already face-down target is discarded to its OWNER'S History (a discarded Landmark cycles/rebuilds on draw like a Hyperscope kill). This realizes Simon's double-deactivation = discard rule; maybeMasiotaRescue already refuses on an already-deactivated card, so a sleeping Masiota Sleep-Potioned just discards with no rescue, consistent. Sleep Potion then spends itself to the caster's History (Artifacts return to History after use); CANCEL leaves it in hand. V1: the Computer doesn't cast it (it buys no Artifacts) but is a valid target — a deactivated AI creature already can't block or attack. Sim preset (two potions in hand, your Cravus + the opponent's Ichor and Pandorama on the board). Verified live all four paths: the picker glowed exactly Cravus/Ichor/Pandorama; deactivating the opponent's Ichor flipped it to a card back (deactivated, NOT secret) and spent the potion to your History; a second potion on that sleeping Ichor discarded it to P2's History; deactivating your own Cravus set faceDownSecret true; the opponent's Pandorama went to sleep as a non-secret card back; CANCEL left both potions in hand with no leftover glow. No console errors." },
        { date: '2026-07-09', msg: "Sea Lord (Duality C8) — implemented (active), completing all 8 Duality Creatures: 'After Sea Lord attacks and is discarded, you may shuffle your History Pile and Future Pile into a new Future Pile.' Hooked at the end of finishAttacker — right after the standard clearSlot + discard-to-History that every attacker goes through, so by the time the offer appears Sea Lord is already in History and cycles back into the deck too (matching the printed 'and is discarded ... shuffle your History Pile'). maybeSeaLordReshuffle() reuses the two rules the End-Phase reshuffle already established rather than inventing new ones: it combines History + Future, exiles any Meridia to the Abyss (she can't be folded into a new Future Pile), shuffles the rest via the shared shuffleArray into the Future Pile, empties History (both piles re-rendered through updateStackIndicator, which handles the slot-empty/label/card-back visuals), and calls resolveGravitasRefill() since forming a new Future Pile from History is exactly Gravitas's trigger. It's optional (confirm), and an empty History+Future is a no-op. V1: the Computer declines (the offer is gated on !aiTurnInProgress), matching Looper/Namandi. Sim preset: Sea Lord (Strength 6) ready, History = Smoke + Ichor, Future = 2 Steam. Verified live both ways — ACCEPT: his direct strike hit P2 Day 12→6, then all five cards (Smoke, Ichor, the 2 Steam, and Sea Lord himself) folded into a Future Pile in a shuffled order (≠ the concatenation, proving the shuffle) with History emptied; DECLINE: the same strike landed and Sea Lord went to History (Smoke, Ichor, Sea Lord) with both piles left untouched. No console errors." },
        { date: '2026-07-09', msg: "Namandi (Duality C7) — implemented (active), per Simon's rulings: he 'gains +1 Strength for each Non-Steam Card you discard while attacking,' where the discard comes from your Hand (or with Atlantica, the wider parked hand), the cards go to your History Pile, and the buff is THIS ATTACK ONLY. Wired as a discard step at the top of triggerAttack (ahead of Hyperscope/target selection, so it reads as 'before attacking'): promptNamandiDiscard() gathers every non-Steam '.hand-slot, .atlantica-slot' card (reusing the exact selector Mines/Atlantica established for 'hand as resource'), pulses them with the red threat-target glow plus a docked bar, and lets you TENTATIVELY toggle any number — each pick locks gold (.namandi-selected) and the bar's live 'Strength N' updates. ATTACK spends the selected cards to History (clearSlot + finishSingleCardPlacement, the standard discard chokepoint) and resumes via a boosted copy { ...attacker, baseStrength: base + bonus, namandiResolved }, so the +Strength threads through the identical Meridius-style pipeline — calculateCurrentStrength reads the copy's baseStrength, so the combat screen, resolveCombat and spillover all use it with ZERO new plumbing; Resistance is untouched (attack-only) and his zone card stays base 3 (he's discarded after attacking anyway). namandiResolved marks the second pass so the chooser can't reopen; CANCEL aborts the whole attack with nothing discarded; an empty eligible set skips the UI straight to a plain attack. V1: the Computer attacks with Namandi at base Strength (the discard branch is gated on !aiTurnInProgress), matching Looper/Hyperscope. Sim preset: Namandi (base 3) in the zone with Smoke + Ichor (eligible) and a FireSteam (Steam, excluded) in hand. Verified live: only Smoke and Ichor pulsed (FireSteam stayed dark, proving the Non-Steam filter); selecting both read 'Strength 5', ATTACK discarded both to History (hand 3→1) with a '+2 Strength' float and the defense screen showed attacker Strength 5; the direct strike hit for 5; a re-run with CANCEL left the hand untouched and returned Namandi to the zone. No console errors." },
        { date: '2026-07-09', msg: "General Wave (Duality C6) — marked implemented (vanilla). His printed ability is '—': he's a plain 6/6/6-class body (health 4/strength 4/resistance 4) with no special effect, so the normal combat engine already runs him correctly, exactly like Ichor. No code was written beyond the checklist flag; nothing to test past confirming he attacks/blocks as a 4/4." },
        { date: '2026-07-09', msg: "Aromeas (Duality C5) — implemented (auto on entry), per Simon's rulings: 'Health Points become half of the Time Points of your active Time Die upon entering the Creature Zone,' rounding UP and FIXED at the moment of entry (it does not follow the die as it changes afterward). The whole effect is one guarded block in finishSingleCardPlacement — the single chokepoint every Creature-Zone placement flows through (normal summon, drag, and the sim loader all route here): when an 'Aromeas' card lands in a creature-zone slot and hasn't been stamped yet, it reads the owner's active die via activeDieType(ownerNum) (reusing Time Bender's groundwork, so a Night-active player halves the Night die), sets HP = Math.ceil(dieTP / 2) into BOTH baseStrength and baseResistance (the single-HP model — Aromeas prints X/X/X), stamps card.aromeasSet so re-renders never recompute, and floats 'N HP (½ of M)'. Because the value is a stored stat like Chrona's split or Meridia's placement HP, 'fixed at entry' is inherent — nothing recomputes it, and it flows through calculateCurrentStrength, resolveCombat and the AI heuristic unchanged (combat needed zero edits). The one display edit: Aromeas prints X/X/X, so unlike other Creatures his computed HP has no printed number to fall back on — updateCreatureVisuals now force-shows his creature-stat-badge (aromeasFixed flag, same always-show path as a rescued Masiota) so the player can always read his stat, even when it happens to equal the base. Sim preset: active Day die pinned to 9 with Aromeas freshly in the zone. Verified live: badge read 5 (⌈9/2⌉, proving round-up over 4) with aromeasSet stamped, matching baseStrength/baseResistance both 5. No console errors. V1 note: the Computer summons Aromeas through the same placement path, so its HP is set identically." },
        { date: '2026-07-09', msg: "Masiota (Duality C4) — implemented (contextual), per Simon's ruling: whenever he would be DISCARDED from the Creature Zone — defeated as a blocker (outright or mutual destruction), spent after his own attack, or sacrificed — his owner may deactivate him in place instead (face down via the deactivation subsystem, damage cleared). Reactivating him, next turn at the earliest, costs 1 Health Point per rescue so far: printed 3 → back at 2 → back at 1; a rescue that would return him at 0 HP is not offered, so two rescues is his lifetime maximum. One shared gate, maybeMasiotaRescue(), is called at all four discard sites (resolveCombat's blocker-defeated + mutual-destruction branches, finishAttacker's after-attack cleanup — where it also disarms a waiting Clone Factory priming — and both sacrifice paths, Repo Station and Dark Matter). Judgment calls wired in: an attack that 'defeats' him still pays the attacker's Repo Station (the defeat happened; only the discard was dodged), but rescuing him from your OWN Repo Station sacrifice pays no Time Point (no sacrifice, no payout), and a Dark Matter sacrifice he dodges still counts as the opponent's one chosen cost. The 'next turn' lock rides a rescue stamp (totalTurns + seat), so a defender's mid-opponent-turn rescue correctly unlocks on their own next turn; same-turn unveiling alerts and refuses. Reactivation heals him fully at the reduced ceiling (baseStrength = baseResistance = printed − uses) with a permanent red badge showing the reduced value (his printed card still says 3), and reduced stats flow through all combat consumers automatically. V1: the Computer never rescues (it takes the discard). Sim preset (Masiota vs a blocking Razo — the 3/3 mirror forces mutual destruction). Verified live: mutual destruction offered 'reactivates next turn at 2 HP', accepting flipped him face down (uses 1) while Razo went to History; same-turn click refused; next turn he reactivated at 2/2 with the red '2' badge; attacking directly then struck for 2 (reduced Strength honored) and offered the second rescue at 1 HP (uses 2). The no-third-rescue gate is the arithmetic floor in maybeMasiotaRescue (3−3=0 → false), verified by code review. No console errors." },
        { date: '2026-07-09', msg: "Looper (Duality C3) — implemented (auto on attack), per Simon's rulings: declaring his attack first rolls a Futory Die (a single scaled-up die face reusing Entrophy's pip builder and ease-out spin — 1-6), and the result is his number of strikes, resolved CLONE FACTORY STYLE: Looper stays in his zone between strikes, the target is re-picked every time (each follow-up re-enters triggerAttack, so a fresh defense screen opens per strike), and he goes to History only after the last one. The defender may block EVERY strike separately — each strike is its own block-or-take decision against the blocker's live state, so a blocker that survived strike 1 with damage blocks strike 2 at its reduced value. 'Any additional effects only apply to the first attack' is enforced by a looperPlainStrike flag stamped on strikes 2+: calculateCurrentStrength returns plain printed Strength (no Cabin buff, no Smoke debuff — a Smoke played against strike 1 does NOT weaken later strikes, by code path), the PLAY ARTIFACT button is disabled (no Smoke/Reflector responses after strike 1), and the Hyperscope targeting step is skipped (later strikes are ordinary player attacks). Plumbing mirrors Clone Factory exactly: a finishAttacker branch keeps him in the zone while strikes remain, and maybeLooperNextStrike() rides the same close-of-overlay hook as maybeCloneSecondStrike. Counters reset in finishTurn and on sim-preset load. V1 notes: the Computer's Looper attacks once (its path calls beginAttack directly, skipping the roll), and a Reflector on strike 1 that kills the chain simply drops the remaining strikes at turn's end. Sim preset (Looper vs Ichor blocker + Smoke in the opponent's hand). Verified live with the die pinned to 3: roll overlay read '3 Attacks! — only the first carries additional effects'; strike 1 offered block + artifact and was repelled by Ichor with Looper staying in the zone; strike 2 auto-opened with PLAY ARTIFACT disabled but blocking still offered; strikes 2-3 landed as plain 'Direct Strike for 1 Damage!' (P2 Day 12→10); after strike 3 Looper moved to History and the overlay chain ended cleanly. No console errors." },
        { date: '2026-07-09', msg: "Razo (Duality C2) — marked implemented (auto): \"Razo can't be deactivated.\" No new code needed — his immunity was built into the deactivation subsystem on day one via canBeDeactivated() (the single gate every deactivation attempt must pass: the Dev-Mode flip today, Sleep Potion and any future deactivator tomorrow), which exempts exactly Atlantica and Razo per their printed rules. This entry makes the checklist honest about it and adds a sim preset (Razo + Ichor in zone) so the immunity is one click to demonstrate. Verified live with Dev Mode on: double-clicking Razo alerted 'Razo cannot be deactivated.' and he stayed face up, while the same gesture flipped Ichor face down. No console errors." },
        { date: '2026-07-09', msg: "Chrona (Duality C1) — implemented (active), first Duality Creature, per Simon's control design: its 4 Health Points (printed 2⚔/2⛨) redistribute between Strength and Resistance when it enters the Creature Zone. Untouched it simply acts like Ichor (2/2, no badge); clicking it during the turn it was summoned walks the legal splits from 1 Strength upward — 1⚔/3⛨ → 2/2 → 3⚔/1⛨ → wrap — with 0 on either side never offered (cycleChronaSplit generates splits from the pool, so a future buffed pool would still work). The split window is enforced by the same summonedOnTurn stamp the summoning-sickness check uses: a capture branch in the zone-click dispatcher (ahead of the attack-menu branch, so no false 'Summoning sickness!' alert during the choice) cycles while summonedOnTurn === totalTurns on the owner's turn, and from the next turn on clicks fall through to the normal attack flow with the split locked. This is the card the engine's strength/resistance groundwork was laid for: baseStrength/baseResistance already feed calculateCurrentStrength, resolveCombat's blocker math, the AI's block heuristic and Hyperscope's creature lock, so combat needed ZERO changes — only display did. An uneven split renders as a pill badge '⚔N ⛨M' (new .chrona-split CSS riding .creature-stat-badge; even split shows nothing, matching the printed card), a '⚔N / ⛨M' float confirms each click, and updateCreatureStatBadge now prefers live baseStrength over the printed stat (fixes the Smoke-debuff badge for a split Chrona attacker too). V1 note: the Computer keeps the default 2/2 when it summons Chrona. Sim preset (Chrona just summoned, window open). Verified live: click sequence read exactly 2/2 → ⚔1 ⛨3 → 2/2 (badge gone) → ⚔3 ⛨1 → ⚔1 ⛨3 with no alerts; set 3⚔/1⛨, passed a full round (P1 End → P2's whole turn → back to P1), and in the new Creature Phase clicking Chrona opened the ATTACK menu instead of cycling, the attack screen showed Strength 3, and the direct strike hit for 3 (P2 Day 12→9). No console errors." },
        { date: '2026-07-09', msg: "Mines of Pyralos (Duality L8) — implemented (active), completing all 8 Duality Landmarks: 'Once per Construction Phase: send 1 of your Cards into the Abyss to look at the top 6 Cards in any Future Pile and rearrange them. Then, draw a Card.' Three-step flow, all built from existing patterns: (1) click the Mines in your Construction Phase → your hand pulses with the red target glow (Atlantica-parked cards included — they work just like the hand) plus a docked SEND A CARD INTO THE ABYSS / CANCEL bar; CANCEL exists only before paying, since the Abyss cost is irreversible once picked (clearSlot + finishSingleCardPlacement to the shared Abyss slot, '{name} Lost' float, landmark pulse). (2) Pick ANY Future Pile — yours or an opponent's — via the same pulse-and-capture-click picker; auto-resolves when only one pile has cards, and if every pile is empty the effect degrades gracefully to just the draw. (3) A rearrange overlay (landmark-choice styling) lays the pile's top N≤6 out as art tiles, leftmost = drawn next, each with ◀ ▶ arrows; CONFIRM ORDER & DRAW splices the new order back onto the untouched rest of the pile and draws 1 via the shared drawCards() — so setting up your OWN next draw works, and a rearranged Landmark on top would rebuild itself on draw (new Duality cycle rule). Once-per-phase guard (minesUsedThisPhase) resets in finishTurn and on sim-preset load (found live: the sim skips finishTurn, so the flag survived a preset reload and the lockout alert froze the harness). Sim preset added (Mines + 2 hand cards, 7-card own Future, 2-card opponent Future) plus p2future support in the sim loader. Verified live: hand pulsed and FireSteam paid to the Abyss; both piles glowed; own pile showed its top 6 of 7 in correct top-first order (bottom card hidden); moving Smoke from 5th to leftmost and confirming drew exactly Smoke, with the remaining pile persisting the confirmed order (Vulcanem next); opponent's 2-card pile opened correctly, its rearrange left it untouched at 2 while the draw came from MY pile; second click same phase correctly refused. No console errors." },
        { date: '2026-07-08', msg: "Hyperscope (Duality L7) — implemented (contextual), per Simon's rulings: a Landmark's Price is its total Steam pip count regardless of color (GGGL = 4), and every Hyperscope-targeted attack resolves WITHOUT the block-or-not choice — the target is locked in (Artifact responses like Smoke/Reflector stay legal on the defense screen, since responding isn't blocking). With Hyperscope in play, ATTACK opens a targeting step instead of striking the player: promptHyperscopeTarget() pulses every face-up enemy Creature and Landmark with the Threat red glow plus a docked STRIKE PLAYER DIRECTLY / CANCEL bar (deactivated face-down cards can't be aimed at — their stats/Price are hidden). The chosen target rides one hyperTarget parameter threaded through the whole attack pipeline (beginAttack → Entrophy's wheel → Meridius scaling → initiateDefense → the artifact-response resume and Reflector redirect), so every attacker keeps its own effect on the way in. Player target = direct unblockable strike (existing path); Creature target = the exact normal combat math via resolveCombat (attacker Str vs its Resistance, spillover to the player, Repo Station/Time Thief hooks intact — mutual destruction and Meridia absorption behave identically); Landmark target = new resolveLandmarkStrike(): the attack's damage accumulates on the Landmark for THIS TURN ONLY (red '⌖ N/Price' badge, cleared with the data in finishTurn via resetHyperscopeTurnDamage), and reaching the Price destroys it into its OWNER'S History (per Simon: a new Duality rule — destroyed Landmarks cycle; when later drawn from the Future Pile they rebuild themselves straight into the Landmark Zone automatically, wired as landmarkRebuildSlot() in drawCards, falling back to the hand only when the zone is full or a duplicate is in play; Threat's printed 'to the Abyss' stays Abyss), attacker to History as usual — Clone Factory's double strike naturally counts twice. Destroyed-landmark cleanup (Atlantica parked cards, Rhone charge) rides the existing clearSlot chokepoint. V1 scope: the Computer doesn't aim Hyperscope itself (plain attack flow); as a defender it simply has no decision and the AI defense handler skips its blocker heuristic. Sim preset (Hyperscope + Cravus/Vulcanem vs Ichor + Pandorama/Gravitas). Verified live: targeting bar + 3 glowing targets; Cravus one-shot Pandorama (2/2) into P2's History and P2's next End-Phase draws rebuilt it into the Landmark Zone with a 'Rebuilt' float; Cravus 2/3 on Gravitas then Vulcanem finished it (8/3); locked Ichor died in mutual destruction with no block prompt; direct player strike hit for 6 (Day 12→6); turn end wiped the 2/3 badge and stored damage; CANCEL fully restored the board. No console errors." },
        { date: '2026-07-08', msg: "Atlantica (Duality L6) — implemented (contextual), per Simon's ruling that parked cards are 'an extension of the hand and work just like the hand': a contextual third row (.atlantica-zone, sea-blue dashed slots) appears below the Landmark Zone the moment Atlantica lands and hides when it leaves. One slot sits behind each Landmark position; while holding a card in your Construction Phase, the empty slots behind ACTIVE Landmarks light up as drop targets (usableAtlanticaSlots() — face-down Landmarks don't qualify), enforcing the printed 1-card-per-Landmark limit by geometry. Parked cards are deliberately NOT .hand-slot (so the Hand Limit, End-Phase draws, discard counter and hand fan never see them — that's the point of the card) but every hand-as-resource path now scans '.hand-slot, .atlantica-slot': autoPayCost, the Bazaar affordability lighting (updateBazaarLighting — found live when a parked FireSteam didn't light an FGL Artifact), Lethargo's steam counting + spending, Aetherlab's upgrade targets, and Clone Factory's GoldSteam. Grabbing a parked card back works through the ordinary click-to-grab flow, so 'just like the hand' holds for replays too. The connected-card rule rides one reconciler, syncAtlanticaZone(): called from clearSlot (Landmark destroyed, e.g. Threat), finishSingleCardPlacement (Landmark arrives) and refreshBoardAfterDeactivation (Landmark flips face down) — any parked card whose Landmark is gone or asleep is discarded to History with a float; if Atlantica itself leaves, the whole row discards and hides. Atlantica can't be deactivated (canBeDeactivated already exempts it). Verified live via sim (Atlantica + Pandorama, 3 Steam in hand): row appeared with exactly 2 slots lit; parking FireSteam dropped hand 3→2 without touching the Hand Limit; buying Dark Matter (FGL) spent the PARKED FireSteam plus hand G+L — the Bazaar tile only unlocked after the affordability fix; parking GoldSteam behind Pandorama and Dev-Mode flipping Pandorama face down discarded the parked card to History while the row (and Atlantica) stayed put. No console errors." },
        { date: '2026-07-08', msg: "Deactivation subsystem (face-down cards) + Hand of Rhone direction choice for 3-4p. Deactivation, per Simon's design: a deactivated card lies FACE DOWN as an actual card back in both cases — deactivated-in-place AND secret placement — for full mystery (cool-dimmed via .card-deactivated so it doesn't read as a Future pile). Two flags in the card data: `deactivated` renders the back and suppresses everything; `faceDownSecret` marks a hidden placement (a Sleep-Potioned Creature entering the zone) that only its owner may peek. Hover rules: your own face-down cards and an opponent's that were deactivated AFTER being shown reveal their front on hover in a dimmed, desaturated 'asleep' modal state (.asleep-preview); a secret placement shows an opponent nothing at all — the hover handler re-reads live slot data, so cards flip visibility correctly after binding. Effect suppression rides the existing chokepoints: findLandmark() treats deactivated Landmarks as absent (silencing Gravitas, Wasteland, Catalyst, Planetarium, Aetherlab, Clone Factory and Rhone's auto-charge — the printed 'unless deactivated' clause now real), all four Pandorama hand-limit checks and cabinBonus() check the flag, face-down Creatures can't block (human picker + AI heuristic), the AI won't attack with one, and stat badges vanish while asleep (refreshBoardAfterDeactivation re-syncs badges/hand limit whenever a card flips). Clicking your own face-down card offers Unveil (flip up + reactivate); an opponent's is not interactable. Atlantica and Razo are exempt via canBeDeactivated(). Until Sleep Potion lands, Dev Mode double-click is the toggle/test path. Rhone: the release now walks seats via rhoneSeat(owner, dir, step) instead of a 2-player alternation; at 3+ players the context window grows a Direction toggle ('→ Towards P2' / '← Towards P4') that live-updates the outcome preview — at 2 players it stays hidden since both directions hit the single opponent first. Verified live: full-charge release regression intact (Opponent −3/You +3, no Direction row at 2p); Dev-Mode flipping Meridia's Cabin face down dropped Ichor's badge 3→base and flipping back restored it with the scan art; owner hover-peek showed the dimmed front; a secret face-down card on the opponent's board showed nothing on hover while the same card without the secret flag showed the asleep preview; clicking your own face-down Ichor unveiled it. No console errors." },
        { date: '2026-07-08', msg: "Hand of Rhone (Duality L5) — implemented (active), per Simon's design: charging is AUTOMATIC — entering your Construction Phase adds +1 Force to the landmark's counting die (capped at 6, shown as a violet '⚡ N Force' badge that turns gold at full charge), hooked into updatePhaseUI's phase-1 branch with a once-per-phase guard, so the Computer's Rhone charges too. Releasing is the player's call: clicking the landmark in your Construction Phase opens the same docked 'Landmark in Use' context window Lethargo's Temple uses, showing the charge and a live outcome preview ('Opponent −2 TP · You −1 TP'), with a Release Force button. The Force travels around the table alternating opponent → you → opponent… for the charged distance, resolving one pass per beat (~550ms) with -1 TP floats on each active die — in 2-player either direction reaches the opponent first, so the direction choice waits for 3-4p. Under 6 it's the shot-in-the-knee trade (3 Force: opponent −2, you −1); at the FULL charge of 6 your own passes heal instead of damage (opponent −3, you +3), routed through gainTimePoints/resolveDamageDirectly so Time Bender's active die and the lost-die cap are respected. Releasing removes the die (charge to 0, badge gone); a destroyed landmark takes its charge with it, and Play Again resets all four counters. The 'unless deactivated' clause on charging is noted and will be wired when the face-down deactivation subsystem lands (needed for Atlantica/Sleep Potion/Razo/Masiota). Sim preset seeds 5 Force so the load-time auto-charge demonstrates itself by completing the full 6. Verified live both ways: at 3 Force the release hit Opponent 12→10 and You 9→8; at 6 the badge went gold, the preview read 'Opponent −3 TP · You +3 TP', and the release finished Opponent 12→9, You 9→12. No alerts, no console errors." },
        { date: '2026-07-08', msg: "Repo Station (Duality L4) — implemented (contextual), per Simon's rulings: 'defeat an opponent's Creature' means your ATTACK destroys their blocker — including mutual destruction, and including Meridia self-sacrificing to swallow your hit — while a repelled attack and defensive blocking give nothing; the sacrifice half is legal in your Construction AND Creature Phases. Auto half: applyRepoStationGain(attackerSlot) is hooked into all three blocker-destroyed branches of resolveCombat (outright defeat, mutual destruction, Meridia absorption); it resolves the owner from the attacker slot's board — not currentPlayer — so it also fires correctly when the Computer's attack defeats a human blocker, and only pays out if that owner actually has Repo Station in play. Active half: click the Station during your Construction or Creature Phase — one Creature in the zone sacrifices immediately; with several, every Creature-type card pulses with the red threat-target glow (Artifact cards lying in the zone via Lotus are excluded — you can't 'sacrifice' a Lotus) and a capture-phase click picks the victim, exactly the Threat/Wasteland picker pattern. Sacrifice = 'Sacrificed' float + clearSlot to your own History + landmark pulse + 1 TP via gainTimePoints (which respects both the 12 cap and Time Bender's active-die routing). Sim preset (Creature Phase, Day 10, Cravus + Vulcanem vs a weakened Ichor). Verified live: clicking the Station pulsed both creatures, picking Vulcanem moved it to History with Day 10→11; then attacking with Cravus into the blocking Ichor read 'Blocker Defeated! 1 Spillover Damage.' and Repo Station paid again, Day 11→12, with Ichor landing in P2's History. No alerts, no console errors." },
        { date: '2026-07-08', msg: "Meridia's Cabin (Duality L3) — implemented (auto), per Simon's ruling on the wording: the History Pile part counts the TOP CARD ONLY (an Artifact on top = +1, never more from History), and 'unoccupied in your Creature Zone' means Artifacts lying there without a Creature on them — today that can only be Lotus (A2, not yet implemented), so the zone half of cabinBonus() already counts Artifact-type cards in Creature-Zone slots and will light up the moment Lotus lands. Every Creature on the Cabin owner's board gains +N to its single HP value (both attack strength and block resistance — Meridia precedent), wired into all four consumers: the zone stat badge (updateCreatureVisuals, reusing the green 'buffed' styling), attack strength (calculateCurrentStrength), the human blocker's resistance in resolveCombat, and the Computer's block-decision heuristic (aiChooseBlocker), so the AI weighs the buff when choosing walls. The interesting part is liveness — the buff moves whenever the History top changes, so updateStackIndicator (the one chokepoint every History write already flows through) now refreshes the board's creature badges on any History change. That also fixes a latent staleness bug for Meridia's own badge, which previously only updated on placement. Sim preset: Cabin + Ichor in zone, Smoke (Artifact) on top of History. Verified live: Ichor's badge showed 3 (2 base + 1, buffed green); discarding a FireSteam onto History covered the Smoke and the badge dropped back to base (no badge) immediately, alert-free, no console errors." },
        { date: '2026-07-08', msg: "Time Bender (Duality L2) — implemented (active): 'Once per Construction Phase, you may switch your active Time Die.' This needed a concept the engine didn't have — until now 'damage comes off the Day die first' was hardcoded in resolveDamageDirectly, gainTimePoints, Fountain of Youth's Skip-Turn grant, and seven scattered float-position ternaries. All of it now routes through one shared pair: playersState gains an activeDie field ('day' default, reset on Play Again) and activeDieType(pNum) resolves which die TP changes hit first — with a built-in fallback, since a die at 0 is permanently lost and can't be active. This is groundwork Duality reuses: Aromeas (C5) reads 'your active Time Die' too. The landmark follows the Clone Factory click pattern: click Time Bender during your Construction Phase (once per phase, reset alongside Aetherlab's flag) to flip the active die — persistent across turns until switched again. Visual language: the landmark pulses, 'Night Active'/'Day Active' floats over the newly active die, and while Night is the active die its counter wears a pulsing cyan marker ring (new .active-die-marker CSS riding the existing blue-die palette; Day-active is the default state and stays unmarked, so the board only glows when something unusual is true). Sim preset: Time Bender in play at Day 10 / Night 8 with Faith + payment in hand. Verified live: clicking the landmark set the marker ring with no alert; a second click correctly refused ('already switched this Construction Phase'); playing Faith then put its +3 TP on the NIGHT die (8→11) while Day stayed at 10 — proof the routing actually moved, since day-first would have gone 10→12 with the remainder spilling to Night. No console errors." },
        { date: '2026-07-08', msg: "Gravitas (Duality L1) — first Duality effect implemented (auto): 'Whenever you shuffle your History Pile to form a new Future Pile, draw Cards until you reach your Hand Limit.' The game has exactly one reshuffle site — the History→Future fold inside drawCards() (the same branch that already handles Meridia's Abyss exile) — so a `reshuffled` flag set there feeds a post-loop hook, resolveGravitasRefill(): it waits 400ms for the in-flight deal animations to actually fill their slots (a dealt slot only becomes occupied ~600ms after its flight starts, while the draw loop waits just 500ms — counting earlier would misread the hand), then measures the deficit against the LIVE hand limit via getMaxHand() (so Pandorama's +2 raises the refill target to 7), pulses the landmark with the shared landmark-triggered glow and floats 'Draw N' over it, and draws the missing cards through the same drawCards() it hooked — safely recursive, since a hand at its limit yields deficit 0 and stops. Fires for whichever player's pile reshuffles (including the Computer's End Phase), which is correct for an auto-intent Landmark. New sim preset (phase 3: 1 card in hand, 1 in Future, 6 in History): the End Phase draw of 2 forces the reshuffle mid-draw. Verified live via sim: draw 1 took the last Future card (hand 2), draw 2 reshuffled all 6 History cards and dealt one (hand 3), then Gravitas pulsed 'Draw 2' and refilled to exactly 5 — Future left holding the 3 undrawn reshuffled cards, History empty, no console errors." },
        { date: '2026-07-07', msg: "Duality set — all 24 Bazaar cards now have their printed prototype scans (assets/cards/duality/, slug-named copies of the drop-in duallity/ folder) and the whole set is playable next to Unity. cardData.js was reconciled against the printed cards, which are the source of truth: the Bazaar order now follows each card's printed position footer (e.g. Gravitas is '1/8 Landmark' → L1, Time Bender L2 … Mines of Pyralos L8; Masiota/Aromeas swapped to C4/C5; Sparks reordered to Alchemy S1, Tame Beast S2, Tele Control S3, Burden of Wealth S4) and numbers 049–072 were reassigned to match. Missing/incorrect costs filled from the scans: Chrona FG, Namandi FGGG, Alchemy FGGG (was AGGG — the printed pip is Fire, not AllSteam). Two names updated to the printed cards: 'Pyralos' → 'Mines of Pyralos' and 'Aqualon' → 'Sea Lord'. All art rendering now routes through one cardArtUrl(card) helper (Steam → assets/, Unity → assets/cards/, Duality → assets/cards/duality/, Destiny/placeholders → none), replacing nine copy-pasted set-gated branches, so Duality cards show their scan everywhere a Unity card would: Bazaar tiles, hand, zones, History top, drag ghosts, AI ghosts, hover modal and Location preview (the HTML PDF mock-up template is kept only for art-less Duality cards, i.e. Destiny and 'Coming soon'). Fusion Play: with both sets active, every non-Steam Bazaar pile is shuffled (shuffleBazaarPilesForFusion(), re-run on every set toggle), so each position shows a random top card from either set and selling it reveals the next random one — verified live: Duality-only shows all 24 correct positions; toggling Unity back on doubled the piles (6-deep Landmarks, 12-deep Creatures) with mixed tops, and a game started in Fusion mode ran the Steam-phase buy normally. Duality card effects remain unimplemented (checklist unchanged, honest)." },
        { date: '2026-07-07', msg: "Computer Opponent — Player 2 can now be driven by a built-in AI at three difficulties (Options → Opponent: Computer, then Easy / Normal / Hard; choice persists via localStorage). The Computer plays through the exact same engine paths a human uses — aiPayCost mirrors autoPayCost, purchases go through the real Bazaar inventory (removeTopFromBazaar), placements use finishSingleCardPlacement, attacks use beginAttack, and phases advance via progressPhase — so every rule the engine knows applies to it identically. Turn shape: Steam Phase picks a Steam buy (Easy: random and sometimes forgets; Normal/Hard: prefers Laser > Gold upgrades but takes the free FireSteam when a good Construction buy is already affordable this turn), Construction buys Creatures/Landmarks per a difficulty profile (buy count + chance; scores Creatures by HP, skips duplicate Landmarks, respects the hand limit), Creature Phase summons its strongest Creature and attacks with everything legal (summoning-sickness check identical to the human path; Cravus/Rampadon instant), End Phase draws 2 and auto-discards to the limit. V1 scope: it does not buy Artifacts or Sparks (interactive targeting) — but it does answer prompts aimed at it: block-or-take on the defense screen (survivor > even-trade > chump-block heuristics, TP-aware), Dark Matter (discards its cheapest card or takes the 2 TP), Threat (pays to keep only when cheap and healthy), Talisman response, and its own Entrophy wheel auto-resolves. Presentation: the view never flips — Player 1 stays anchored at the bottom, no PASS DEVICE screen in Computer mode; the opponent's hand renders as a fan of card backs that grows/shrinks live (syncMiniHandFan + count pulse), its buys/summons fly across the board as red ghost cards, the phase bar narrates its progress under a COMPUTER label, and a collapsible live action feed (top right) logs every move with BUY/PLAY/FIGHT/DRAW tags — watching is optional, and the only hard stop for the human is the existing block/artifact decision when its creature attacks. Board input is pointer-locked during its turn (with an exception for the mid-combat artifact picker). Verified live: full Computer turn (FireSteam buy → Pandorama build paying AA → Ichor summon → draw 2 → hand-off), its Ichor attack pausing on my defense screen and resolving 2 damage Day-die-first after CONTINUE, and the reverse direction — my Cravus attack locked the defense screen with 'Computer is deciding…', it correctly declined the 2-for-2 even trade on Normal, took 2 TP (24→22), and the overlay closed itself." },
        { date: '2026-07-07', msg: "Confiscation (S4) — implemented (active): 'Look at target Opponent's Hand and take one Card to your Hand.' In 2-player V1 the opponent is automatic (resolveConfiscation() picks the other seat directly); with 3-4 players it reuses the exact same #target-player-overlay/#target-player-list pattern the Creature Attack flow and Dark Matter already use to ask which opponent, rather than inventing a new targeting UI — so adding more seats later needs no new Confiscation-specific code. Once the target is settled, showConfiscationPicker() reveals their Hand: auto-takes the card if they only have one, otherwise opens a 'Confiscation — P{n}'s Hand' list (same overlay styling as Reversal's History picker) naming every card so the caster can actually look before choosing; picking one moves it via the standard clearSlot()+finishSingleCardPlacement() into the caster's Hand (opening a temporary slot if full). A no-op if the target's Hand is empty. Preset updated to buy Confiscation from Bazaar S4 directly (matching the Reversal/Threat convention) instead of pre-seeding it in Hand. Verified via sim: P2 has Ichor/Cravus/Smoke — buying Confiscation opened the P2 Hand list showing all three, and picking Smoke moved it into P1's Hand while Ichor/Cravus stayed put and Confiscation itself landed in the Abyss." },
        { date: '2026-07-07', msg: "Threat (S3) — implemented (active): 'Send an active Landmark of your choice to the Abyss, unless its owner pays 2 TP for each Landmark they own.' Targeting is cross-board and deliberately unrestricted — allLandmarksInPlay() collects every occupied Landmark slot from BOTH players' boards (tagged with its owner), so the caster can pick an opponent's Landmark OR their own on purpose (e.g. torching your own Meridius-boosting Landmark once it's done its job). Auto-resolves straight to the owner's choice screen if there's only one Landmark in play; otherwise promptThreatTarget() pulses every eligible Landmark on both boards with a red 'threat-target' glow (new CSS, styled like the existing green heal-target pulse) and a capture-phase click handler picks the target. beginThreatChoice() then computes the live cost via the existing countLandmarks(owner) helper (2 × however many Landmarks that owner owns right now, including the threatened one) and shows a small two-button PAY / SEND TO ABYSS overlay (same visual pattern as the Landmark discard conflict chooser) — PAY is grayed out if totalTimePoints(owner) can't cover it. Paying spends TP via the existing resolveDamageDirectly(cost, owner) (Day die first, same as combat); declining (or being unable to pay) discards the Landmark straight to the Abyss via clearSlot()+finishSingleCardPlacement(), same as any other Landmark removal. Extended the Threat sim preset with a Landmark on each board (P1: Fountain of Youth, P2: Pandorama + Clone Factory) instead of a pre-seeded Hand copy, since Threat now buys instantly from the Bazaar like the other Sparks. Verified via sim: bought Threat from Bazaar S3 with 3 Landmarks in play — all three glowed as valid targets; picking your own Fountain of Youth (P1, owns 1) correctly priced it at 2 TP and choosing Send to Abyss discarded it immediately; picking the opponent's Clone Factory (P2, owns 2) priced it at 4 TP and paying dropped P2's Day die 12→8 while the Landmark stayed in play." },
        { date: '2026-07-07', msg: "Reversal (S1) / Faith (S2) — reworked how Sparks get played, per feedback that the grab-from-Bazaar-then-drop-on-Abyss gesture was confusing (you'd grab the card and then not know what to do with it). Sparks now buy-and-play in a single click: clicking a Spark's Bazaar tile pays its cost, resolves the effect immediately, and sends the card straight to the Abyss — it never passes through Hand. New logic lives in the Bazaar click handler (checked right after the 'unavailable' gate, before the old allSame-grab branch): copies the top card, calls the existing autoPayCost(), splices it out of activeBazaar, then reuses finishSingleCardPlacement() + resolveSparkEffect() to land it in the Abyss and fire its effect, exactly like the old drop-on-Abyss path did. The old grab-then-drop-on-Abyss mechanic (highlightValidZones' Spark branch, the click-to-place special-case on the Abyss tile, resolveSparkEffect's call inside placeCard) is left in place as a fallback — it's still what the Dev Log sim presets use (they seed Sparks directly into Hand for isolated single-card testing) and covers any future case where a Spark legitimately ends up in Hand. Verified via sim: loaded the Reversal preset (Ichor+Smoke in History, FireSteam+2 GoldSteam in Hand), then clicked the Bazaar's S1 tile directly (not the preset's Hand copy) — payment cards were spent from Hand, a fresh Reversal went straight to the Abyss, and the 'Take Which Card?' picker opened immediately with no grab step; picking Ichor moved it to Hand and left Smoke in History. Confirmed non-Spark buys (e.g. Landmarks) are unaffected — still gated by the existing 'unavailable'/afford checks and still use the grab/drop flow." },
        { date: '2026-07-06', msg: "Reversal (S1) / Faith (S2) — both implemented (active), plus the Abyss now actually works as a zone. Sparks resolve their effect the instant the card lands in the Abyss (new resolveSparkEffect() hook in placeCard) — that drop already was the existing 'play a Spark' gesture, so it doubles as the trigger. Reversal: take a Card from your History Pile into your Hand — auto-resolves with one History card, otherwise opens a 'Take Which Card?' picker (same overlay style as the Landmark discard conflict chooser); no-ops harmlessly if History is empty. Faith: draws a Card and grants 3 Time Points via the existing drawCards()/gainTimePoints(). Along the way, fixed the Abyss itself: it was a dead zone before this — cardData has no entries at Bazaar location 'AB', so activeBazaar['AB'] was always empty, meaning the shared Abyss slot always rendered as an empty pile and clicking it did nothing, even though finishSingleCardPlacement was already writing sent-there cards into its own dataset.cardData. renderBazaar() and the Bazaar click handler now special-case loc 'AB' to read/display that dataset directly: a count badge ('N IN ABYSS') appears once occupied, and clicking it opens a view-only 'Abyss — Out of Game' list (no grabbing back — cards there are gone for good) so either player can inspect what's been sent there. Verified via sim presets: Reversal preset (Ichor + Smoke in History) — picking Smoke moved it to Hand, left Ichor in History, sent Reversal to Abyss; Faith preset — playing it drew a FireSteam and sent Faith to Abyss (3 TP grant capped out silently since both dice already sat at 12, matching gainTimePoints' existing cap behavior). Clicking the Abyss slot after both plays listed both cards; marked both done on the Card Implementation checklist." },
        { date: '2026-07-06', msg: "Reflector (A3) / Talisman (A4) — both implemented (active). Reflector: playable from the existing PLAY ARTIFACT step of the Creature Attack defense screen; V1 is 2-player only, so 'change the attack target to a Player of your choice' resolves as bouncing the attack straight back at the attacker (new handleReflectorRedirect() + resolveReflectedAttack(), which deals the attacker's current Strength directly to them with no blocking step, then sends the attacker to History as normal). Talisman: wired as a general contextual response (offerTalismanResponse()) rather than a Reflector-only special case, since its text ('prevent a Card that targets you or any of your Cards') isn't scoped to one Artifact — any future targeted effect can call it. It fires right after Reflector redirects: the device passes to the newly-targeted player first (keeping hand contents hidden from whoever currently holds it) and a RESPOND? prompt only appears if they're actually holding Talisman; playing it moves both Reflector and Talisman to the responder's History Pile and resumes the original defense screen against the original defender, while declining (or not holding it) lets the reflected damage land. Extended both cards' sim presets with an attacking Ichor and the response card in the defender's hand (matching the existing Smoke preset's pattern) and marked both done on the Card Implementation checklist. Verified via sim preset walkthrough: P1's Ichor attacks P2, P2 plays Reflector, and with no Talisman in P1's hand the attack immediately bounces back — the redirected damage lands on P1 (the attacker) and Ichor moves to P1's History; with the Talisman preset loaded, a RESPOND? prompt appears for P1, and choosing PLAY TALISMAN sends both Reflector and Talisman to P1's History and reopens the original defense screen for P2 against Ichor." },
        { date: '2026-07-06', msg: "Dark Matter (A2) — effect implemented (active): click it in hand during your Construction Phase to discard it to your History, draw a card, and (2-player V1: automatically, 3-4p: via the existing target-player-overlay) force the opponent into a new Dark Matter choice screen modeled on the Creature Attack modal — three buttons, SACRIFICE CREATURE / DISCARD CARD / LOSE 2 TIME POINTS, only one is ever taken. Each option auto-resolves when there is exactly one legal instance (a single Creature in zone, a single card in hand) and otherwise opens an inline picker reusing the Creature Attack screen's blocker-picker pattern so the opponent chooses which one. Sacrifice/discard move the chosen card to the defender's own History Pile (finishSingleCardPlacement) with a floating 'Sacrificed'/'Discarded' label; losing 2 TP routes through the existing resolveDamageDirectly (Day die first, same as combat damage). Disabled options are grayed out (e.g. no button if the opponent has zero Creatures or an empty hand) so it's clear only one selection is required. Verified via sim preset (Dark Matter + full payment in P1 hand, Construction Phase): clicking it discarded it to History, drew a card, and opened the choice screen targeting P2." },
        { date: '2026-07-06', msg: "Time Thief (C6) — effect implemented (auto on attack): gains Time Points equal to the TOTAL damage he deals in one attack, no matter how it splits between a blocking Creature and spillover to the player — shared via a new applyTimeThiefGain(), hooked into both the unblocked direct-strike path and the blocked-combat path (all three outcomes: blocker defeated + spillover, attacker repelled, mutual destruction all still count as 'damage dealt' and grant TP; Meridia blocking him also counts, since he still dealt the damage even though she prevents it going anywhere). Damage is read post-debuff (e.g. Smoke's -1 Strength lowers the gain too, since it reduces calculateCurrentStrength before the gain is computed). Routed through the existing gainTimePoints(), which already refuses to top up a Day die that's hit 0 and been permanently removed — so a player capped at 12 TP forever stays capped at 12 even when Time Thief hands them TP. Verified via sim: direct strike for 3 grants +3 TP float on the Day die." },
        { date: '2026-07-06', msg: "Meridia (C5) — effect completed (auto): her Health/Strength/Resistance is 0 base, +1 for each Artifact in her owner's History Pile (badge shown via meridiaArtifactBonus(), shared by zone display, attack, and block). Fixed a latent bug along the way: baseStrength/baseResistance init used `parseInt(...) || 1`, which clobbered a legitimate 0 (Meridia's base) back up to 1 — switched to an isNaN check in both finishSingleCardPlacement and the sim harness's creature loader. Three deviations wired in: (1) placing her in the Creature Zone with 0 effective HP (no Artifacts in History) now sacrifices her straight to History — 'Sacrificed (0 HP)' floats then she's discarded via checkMeridiaZeroHp(); (2) as a blocker she swallows the whole attack — any damage she takes sacrifices her and prevents ALL spillover to the player, regardless of the attacker's Strength; (3) when her owner's History reshuffles into a new Future Pile, Meridia is filtered out and sent to the Abyss instead of being shuffled back in. Also reordered the sim harness to load History before Creatures so History-dependent stats are correct at placement time. Verified via sim/manual state: 0-Artifact placement auto-sacrifices to History; 2-Artifact placement now correctly shows HP badge 2 (previously misread as 3 due to the `|| 1` bug) and survives; forcing an End Phase reshuffle with Meridia in History sends her to the Abyss (bazaar AB slot goes from empty to occupied) and leaves the rest shuffled into Future. The blocker-absorption branch mirrors the existing resolveCombat blocker-defeated path (clearSlot + finishSingleCardPlacement to History) and was verified by code review rather than a live combat click-through." },
        { date: '2026-07-05', msg: "Creature Attack screen — now shows the attacker's effective attack Strength on its card, plus both players' total Time Points (P#(Attacker) · N TP / P#(Defender) · N TP), so the defender can weigh blocking vs. spending an Artifact. This is also where Meridius's buff now surfaces." },
        { date: '2026-07-05', msg: "Meridius (C4) — effect implemented (auto on attack): when he attacks, he gains +1 Strength for each Landmark the defending player owns (base 2), and becomes unblockable if they own 3+. Scaling is computed against the chosen defender in beginAttack via countLandmarks(), reusing the shared attacker.unblockable flag. The buff is shown ONLY in the Creature Attack screen (not the zone badge) — it's attack-only, so it must not read as block strength, and with 3+ players it's unclear which opponent it scales off until you target. His native Health/block stays 2. Verified via sim (opponent with 3 Landmarks): attack-screen Strength reads 5, block disabled + 'Unblockable Attacker Detected!', direct strike for 5; at 2 Landmarks it reads 4, is blockable, and strikes for 4." },
        { date: '2026-07-05', msg: "Entrophy (C3) — effect implemented (auto on attack): after you target a player, a casino-style wheel of the six die faces spins over the card — fast, then decelerating (ease-out), landing on a random face with a gold flash. The outcome rides on top of its base Strength 2: (1) No additional effect — attacks with 2; (2) +3 Strength — attacks with 5; (3) Unblockable — attacks with 2, no block; (4) +4 Time Points — you gain 4 TP, attack still lands with 2; (5) To Opponent's Hand — no attack, Entrophy is handed to the defender; (6) Attacks You — 2 damage to yourself, then to History. Generalized the old Rampadon-only 'unblockable' check into an attacker flag so the Unblockable face reuses it. Wheel appears after target selection (works for the 4-player path too). Verified via sim: all six outcomes — str 2 / str 5 / unblockable (block disabled) / +4 TP float + attack / creature moved to opponent hand with no attack / self takes 2 and Entrophy to History." },
        { date: '2026-07-04', msg: "Aetherlab (L8) — trade UI reworked into two direct interactions (still once per Construction Phase). Method A: click the landmark to arm it — every upgradeable hand Steam (Fire/Gold with the next tier in stock) glows gold; click one to trade it up in place. Method B: grab a Steam from hand and drop it on its own drawer or the next-tier drawer above the Bazaar (those drawers glow while held) and it upgrades automatically. Either way the traded-in Steam returns to its Bazaar drawer and the next tier lands in hand. LaserSteam never glows (top tier). Replaces the old modal chooser; landmark only pulses (no persistent glow). Armed mode clears on re-click, phase change, or turn end. Verified: arm + click FireSteam → GoldSteam (Fire returned to ST1, once-per-phase locked); drag GoldSteam onto Laser drawer → LaserSteam; Laser has no glow/target." },
        { date: '2026-07-04', msg: "Clone Factory (L7) — effect implemented (active): during the Creature Phase, click the Factory to discard a GoldSteam from hand and prime a double attack. The landmark glows gold with an '⚔ Attack ×2' badge; the next Creature you attack with strikes twice in a row instead of going to History after its first strike. Between strikes the attacker stays in its zone; on the second strike you re-pick the target (single opponent in 2-player V1) and, once it resolves, the creature moves to History and the glow clears. Priming needs a GoldSteam (alerts otherwise); an unused priming drops when you leave the Creature Phase. Shared finishAttacker() gate wraps both the direct-strike and blocked-combat cleanup paths. Uses the existing Clone Factory sim preset (Rampadon + GoldSteam). Verified: activate discards GoldSteam + glows; direct strike twice for full damage; blocked first strike then direct second; leaving Creature Phase clears an unused priming." },
        { date: '2026-07-02', msg: "Lethargo's Temple context window now shows the hovered card + its full payment breakdown (e.g. \"Planetarium — 1 Fire + 5 TP\"), recomputed live when you flip the Steam+TP / Only-TP toggle. Clears to a hint on mouse-out. Verified: FGL reads \"1 Fire + 5 TP\" with a fire-only hand, \"6 TP\" in Only-TP mode." },
        { date: '2026-07-02', msg: "Lethargo's Temple (L2) — effect implemented (active, once per Construction Phase): click the Temple to arm TP-buy mode. Bazaar cards you can't afford in Steam but can cover with Time Points light up with a purple 'unlocked' glow, and hovering any card shows its live TP cost. A new contextual 'Landmark in Use' window docks below the phase panel with a payment toggle — Steam + Time Points (spend steam first, TP for the gap) or Only Time Points (full TP). Buying spends the planned steam cards to History and drains TP off the Day die with a floating '-N TP' readout. Closes on re-click, after the purchase, or on phase change. Verified: activate lights 20 cards; hover L5 (LLLL) = 12 TP; FFF buy with 2 FireSteam = 2 steam + 1 TP (Day 10->9); Only-TP FFF = 3 TP, no steam spent (Day 10->7); once-per-phase lockout; all three close paths." },
        { date: '2026-07-02', msg: 'Planetarium fix: staging a second card onto the armed landmark no longer accidentally triggers the draw. Only the lower third of the armed card commits (marked with a blue "click strip" + "▶ Draw N" badge); the upper two-thirds stay a drop zone for staging more, and while you are holding a card any click on it stages rather than commits. Verified: dropped a 2nd card while holding -> Draw 1 -> Draw 2 with no premature draw; empty-handed upper-third click was inert; lower-third click drew all staged (Future 4 -> 2).' },
        { date: '2026-07-02', msg: 'Discard landmarks now work two ways. Path 1 (existing): drop a card into your own History and the game auto-resolves (or asks on a genuine conflict). Path 2 (new — direct selection): when you pick up a card, every landmark that could consume it glows green; dropping the card onto a landmark discards it to History and fires THAT landmark, no chooser needed. Shared eligibility via getDiscardLandmarkOptions(); highlighting reuses the grab flow. Verified: grabbing a FireSteam lights Wasteland (and Planetarium when both are present); dropping on Wasteland healed + discarded, dropping on Planetarium staged a draw with no chooser and left the creature untouched.' },
        { date: '2026-07-02', msg: 'Planetarium (L4) — effect implemented (contextual, once per Construction Phase): discard any number of cards into your own History (each one arms the landmark with a persistent glow and a "Draw N" badge), then click the Planetarium to draw that many from Future all at once. Drawing only on commit prevents cherry-picking draws mid-discard. Safety net: advancing past Construction auto-commits any staged draws. Refactored the End-Phase draw loop into a shared drawCards(pNum, count) used by both. Added a "Which Landmark?" chooser for the genuine conflict (FireSteam in Construction with both Wasteland and Planetarium eligible) — all other discards resolve automatically. Added Future-pile support + a Planetarium preset to the sim harness. Verified: staging/commit (Future 4 → 2, hand +2), once-per-turn lockout, the conflict chooser (picking Wasteland healed instead of staging), and no End-Phase draw regression.' },
        { date: '2026-07-02', msg: "Dragura's Wasteland (L3) — effect implemented (contextual): discarding a FireSteam into your own History during the Construction Phase fully heals a damaged Creature. One damaged Creature auto-heals; with several, they glow green and the player clicks which to heal. Wasteland pulses and a \"Healed\" float rises over the creature. Intent badge changed Active → Contextual. Verified via sim: single-target auto-heal (dmg 2 → 0) and multi-target pick (healed the chosen creature, left the other at 1)." },
        { date: '2026-07-02', msg: 'Laser Catalyst (L5) — effect implemented (contextual): discarding a LaserSteam into your own History during the End Phase deals 1 unpreventable damage to the opponent (auto-targeted in 2-player V1, day die first). No menu — the Catalyst glows and a "-1 TP" float rises over the opponent\'s die. Intent badge changed Active → Contextual to match. Verified via sim: two discards took the opponent 12 → 11 → 10.' },
        { date: '2026-07-02', msg: 'Landmark trigger feedback (shared): added pulseLandmark() + floatValue() helpers and matching CSS (.landmark-triggered glow, .float-value rise). Wired Fountain of Youth first — Skip Turn now pulses the landmark and floats "+1 TP" over the gaining die instead of applying the Time Point silently. Reusable for Laser Catalyst / Wasteland / Planetarium next.' },
        { date: '2026-07-02', msg: 'Dev Log: made Card Implementation the default/left tab and Update History the second tab.' },
        { date: '2026-07-02', msg: 'Auto-discard at hand limit: the End Phase "Discard (X)" button is now clickable and discards the X cheapest cards from Hand to the History Pile. Cheapness is ranked by Steam tier (Laser > Gold > Fire > AllSteam, cheapest), so a single Laser outranks any number of Fires and an empty/"-" cost (e.g. FireSteam) is cheapest.' },
        { date: '2026-07-02', msg: 'Removed the manual Day/Night die +/- adjuster buttons (leftover from fully-manual play); card effects handle Time Points now. Clicking a die face still lowers it by 1.' },
        { date: '2026-07-02', msg: 'Added Dev Mode (toggle button next to Dev Log, or press M): freely grab any card from anywhere (Bazaar, hands, zones) and drop it into any zone on either board, ignoring cost, phase, and type restrictions. Bazaar slots stay non-reorderable. Button glows gold and a "DEV MODE" banner shows while active; toggling off cleanly returns any held card and clears highlights.' },
        { date: '2026-07-02', msg: 'Locked Player Count to 2 in Options (3/4 show a "Coming Soon" toast instead of expanding the board) while keeping the 3-4 player layout code intact for later.' },
        { date: '2026-07-02', msg: 'Split Creature HP into separate Strength and Resistance values in cardData/runtime state (e.g. Ichor: Strength 2, Resistance 2), preparing for future cards that redistribute them independently.' },
        { date: '2026-04-11', msg: 'Updated combat resolution: Changed automatic timer to a manual "Close" button for better readability of battle results.' },
        { date: '2026-04-11', msg: 'Refined combat UI: Removed redundant buttons, integrated toggle-based blocking, and replaced alerts with in-game feedback.' },
        { date: '2026-04-11', msg: 'Added visual combat enhancements with blocker previews, state-toggling, and card-tap animations.' },
        { date: '2026-04-11', msg: 'Implemented full combat resolution logic including spillover damage and automated history card movement.' },
        { date: '2026-04-11', msg: 'Integrated multiplayer targeting UI with circular player indicators for 3-4 player games.' },
        { date: '2026-04-11', msg: 'Added Dev Log tracking system to manage and display technical progress history.' },
        { date: '2026-04-10', msg: 'Finalized Steam phase purchase logic and Bazaar visibility mechanics during the game loop.' },
        { date: '2026-04-10', msg: 'Implemented expanding hand-fan UI and end-phase card limit enforcement with discard mechanics.' },
        { date: '2026-04-09', msg: 'Resolved card cloning bugs and synchronized card placement state across player zones.' }
    ];

    function renderDevLog() {
        const container = document.getElementById('devlog-content');
        container.innerHTML = '';
        devLogData.forEach(entry => {
            const div = document.createElement('div');
            div.className = 'log-entry';
            div.innerHTML = `
                <div class="log-date">${entry.date}</div>
                <div class="log-msg">${entry.msg}</div>
            `;
            container.appendChild(div);
        });
    }

    function renderChecklist() {
        const container = document.querySelector('#devlog-checklist .checklist-grid');
        if (!container) return;
        container.innerHTML = '';

        cardData.forEach(card => {
            const isDone = implementedCards.includes(card.name);
            const intent = intentMap[card.name];
            const hasSim = !!simulationMap[card.name];

            const item = document.createElement('div');
            item.className = `check-item ${isDone ? 'done' : ''}`;

            const top = document.createElement('div');
            top.className = 'check-top';
            top.innerHTML = `
                <span class="name tech-font">${card.name}</span>
                <span class="status">${isDone ? '<span class="status-ok">✔</span>' : '<span class="status-x">✘</span>'}</span>
            `;

            const bottom = document.createElement('div');
            bottom.className = 'check-bottom';

            if (intent) {
                const badge = document.createElement('span');
                badge.className = `intent-badge intent-${intent}`;
                badge.textContent = intent === 'auto' ? 'Auto' : intent === 'contextual' ? 'Contextual' : 'Active';
                bottom.appendChild(badge);
            }

            if (hasSim) {
                const simBtn = document.createElement('button');
                simBtn.className = 'sim-run-btn tech-font';
                simBtn.textContent = '▶ Sim';
                simBtn.title = simulationMap[card.name].desc;
                simBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    runSimulation(card.name);
                });
                bottom.appendChild(simBtn);
            }

            item.appendChild(top);
            if (intent || hasSim) item.appendChild(bottom);
            container.appendChild(item);
        });
    }

    function runSimulation(cardName) {
        const sim = simulationMap[cardName];
        if (!sim) return;

        if (devlogScreen) devlogScreen.classList.add('hidden');

        function applyState() {
            currentPlayer = 1;
            currentPhase = sim.phase !== undefined ? sim.phase : 1;
            totalTurns = 10; // High value so summoning sickness checks work normally

            // Sync active player display
            document.querySelectorAll('.player-zone').forEach(z => z.classList.remove('active-player'));
            const board1 = document.getElementById('player-1');
            if (board1) board1.classList.add('active-player');
            const gf = document.getElementById('game-field');
            if (gf) gf.className = `players-${activePlayerCount} turn-p1`;
            const lbl = document.getElementById('active-player-label');
            if (lbl) lbl.textContent = 'PLAYER 1';

            function setupBoard(pNum, cfg) {
                const board = document.getElementById(`player-${pNum}`);
                if (!board) return;

                if (cfg.day !== undefined) { playersState[pNum].day = cfg.day; updatePlayerDieUI(pNum, 'day'); }
                if (cfg.night !== undefined) { playersState[pNum].night = cfg.night; updatePlayerDieUI(pNum, 'night'); }

                // Hand
                if (cfg.hand) {
                    board.querySelectorAll('.hand-slot').forEach(s => {
                        s.classList.add('slot-empty');
                        s.style.backgroundImage = '';
                        s.style.backgroundColor = '';
                        s.textContent = '';
                        delete s.dataset.cardData;
                    });
                    const hSlots = Array.from(board.querySelectorAll('.hand-slot'));
                    cfg.hand.forEach((name, i) => {
                        const found = cardData.find(c => c.name === name);
                        if (found && hSlots[i]) finishSingleCardPlacement(hSlots[i], { ...found });
                    });
                    updateHandLayout(pNum);
                }

                // Landmarks
                if (cfg.landmarks) {
                    board.querySelectorAll('.landmark-zone-main .card').forEach(s => {
                        s.classList.add('slot-empty');
                        s.style.backgroundImage = '';
                        s.style.backgroundColor = '';
                        s.textContent = '';
                        delete s.dataset.cardData;
                    });
                    const lSlots = Array.from(board.querySelectorAll('.landmark-zone-main .card'));
                    cfg.landmarks.forEach((name, i) => {
                        const found = cardData.find(c => c.name === name);
                        if (found && lSlots[i]) finishSingleCardPlacement(lSlots[i], { ...found });
                    });
                }

                // History Pile (loaded before Creatures so History-dependent effects,
                // e.g. Meridia's Artifact-count HP, see the right state when she's placed).
                if (cfg.history) {
                    const histSlot = board.querySelector('.history-pile');
                    if (histSlot) {
                        const items = cfg.history.map(name => cardData.find(c => c.name === name)).filter(Boolean);
                        histSlot.dataset.cardData = JSON.stringify(items);
                        histSlot.classList.remove('slot-empty');
                        updateStackIndicator(histSlot);
                    }
                }

                // Creatures
                if (cfg.creatures) {
                    board.querySelectorAll('.creature-zone-main .card').forEach(s => {
                        s.classList.add('slot-empty');
                        s.style.backgroundImage = '';
                        s.style.backgroundColor = '';
                        s.textContent = '';
                        delete s.dataset.cardData;
                    });
                    const cSlots = Array.from(board.querySelectorAll('.creature-zone-main .card'));
                    cfg.creatures.forEach((spec, i) => {
                        const found = cardData.find(c => c.name === spec.name);
                        if (found && cSlots[i]) {
                            const summonTurn = spec.forceThisTurn ? totalTurns : 0;
                            const pStr = parseInt(found.strength ?? found.health);
                            const pRes = parseInt(found.resistance ?? found.health);
                            const c = { ...found, baseStrength: Number.isNaN(pStr) ? 1 : pStr, baseResistance: Number.isNaN(pRes) ? 1 : pRes, damageTaken: spec.damageTaken || 0, summonedOnTurn: summonTurn };
                            finishSingleCardPlacement(cSlots[i], c);
                            updateCreatureVisuals(cSlots[i]);
                        }
                    });
                }

                // Future Pile (deck to draw from — e.g. for Planetarium)
                if (cfg.future) {
                    const futSlot = board.querySelector('.future-pile');
                    if (futSlot) {
                        const items = cfg.future.map(name => cardData.find(c => c.name === name)).filter(Boolean);
                        futSlot.dataset.cardData = JSON.stringify(items);
                        futSlot.classList.remove('slot-empty');
                        futSlot.style.backgroundImage = "url('assets/card_back.png')";
                        futSlot.style.backgroundColor = 'transparent';
                        const label = futSlot.querySelector('.pile-label');
                        if (label) label.style.display = 'none';
                        updateStackIndicator(futSlot);
                    }
                }
            }

            setupBoard(1, {
                day: sim.day,
                night: sim.night,
                hand: sim.hand,
                landmarks: sim.landmarks,
                creatures: sim.p1creatures,
                history: sim.p1history,
                future: sim.p1future,
            });

            if (sim.p2landmarks || sim.p2hand || sim.p2creatures || sim.p2future) {
                setupBoard(2, {
                    landmarks: sim.p2landmarks,
                    hand: sim.p2hand,
                    creatures: sim.p2creatures,
                    future: sim.p2future,
                });
            }

            // Per-phase/turn flags don't survive a preset reload (the sim skips finishTurn).
            minesUsedThisPhase = false;
            resetLooper();

            // Pre-charge Hand of Rhone (its auto +1 then fires via updatePhaseUI below).
            if (sim.rhoneCharge !== undefined) {
                rhoneCharge[1] = sim.rhoneCharge;
                rhoneChargedThisPhase = false;
                updateRhoneBadge(1);
            }

            const phaseUI = document.getElementById('game-phase-display');
            if (phaseUI) phaseUI.classList.remove('hidden');
            updatePhaseUI();
            updateBazaarLighting();
            checkHandLimit();

            // Toast notification
            const toast = document.createElement('div');
            toast.className = 'sim-toast tech-font';
            toast.innerHTML = `<strong>SIM: ${cardName}</strong><br><span>${sim.desc}</span>`;
            document.body.appendChild(toast);
            setTimeout(() => toast.classList.add('sim-toast-visible'), 50);
            setTimeout(() => { toast.classList.remove('sim-toast-visible'); setTimeout(() => toast.remove(), 400); }, 4000);
        }

        if (!gameStarted) {
            if (window.handleStartGame) window.handleStartGame();
            setTimeout(applyState, 800);
        } else {
            applyState();
        }
    }

    function initPlayerBoard(pNum) {
        const container = document.getElementById(`player-${pNum}`);
        if (!container) return;
        
        container.innerHTML = '';
        const clone = playerBoardTemplate.content.cloneNode(true);
        
        const creatureZoneMain = clone.querySelector('.creature-zone-main');
        const historyPileContainer = clone.querySelector('.history-pile-container');
        const landmarkZoneMain = clone.querySelector('.landmark-zone-main');
        const futurePileContainer = clone.querySelector('.future-pile-container');
        
        // Populate 5 Main Slots
        for (let i = 0; i < 5; i++) {
            landmarkZoneMain.appendChild(createSlot('landmark'));
            creatureZoneMain.appendChild(createSlot('creature', i === 2));
        }

        // Atlantica (Duality L6): contextual extended-hand row below the Landmark Zone.
        // One slot behind each Landmark position; only shown while Atlantica is in play.
        const atlanticaZone = document.createElement('div');
        atlanticaZone.className = 'board-main-slots atlantica-zone hidden';
        for (let i = 0; i < 5; i++) atlanticaZone.appendChild(createSlot('atlantica'));
        landmarkZoneMain.parentNode.insertAdjacentElement('afterend', atlanticaZone);

        // Populate stacks
        const futureSlot = createStackSlot('Future', 'future-pile');
        const historySlot = createStackSlot('History', 'history-pile');
        
        futurePileContainer.appendChild(futureSlot);
        historyPileContainer.appendChild(historySlot);

        // --- Initialize Standard Deck (5 FireSteam, 2 GoldSteam, 1 Ichor) ---
        const fireSteam = cardData.find(c => c.number === 'STM1');
        const goldSteam = cardData.find(c => c.number === 'STM2');
        const ichor = cardData.find(c => c.number === '009');

        if (fireSteam && goldSteam && ichor) {
            let deck = [];
            for(let i=0; i<5; i++) deck.push({...fireSteam});
            for(let i=0; i<2; i++) deck.push({...goldSteam});
            for(let i=0; i<1; i++) deck.push({...ichor});
            
            shuffle(deck);
            
            futureSlot.dataset.cardData = JSON.stringify(deck);
            futureSlot.classList.remove('slot-empty');
            
            // Visual for Future Pile (Face Down)
            const backImg = 'card_back.png';
            futureSlot.style.backgroundImage = `url('assets/${backImg}')`;
            futureSlot.style.backgroundColor = 'transparent';
            futureSlot.querySelector('.pile-label').style.display = 'none';
            
            updateStackIndicator(futureSlot);
            bindHoverToElement(futureSlot, deck[deck.length - 1]);
        }

        container.appendChild(clone);
        
        // Ensure symmetrical hand layout matches the initial slots
        updateHandLayout(pNum);

        // Click on die face — manual Time Point adjustment, Dev Mode only
        const diceNum = container.querySelectorAll('.circle-counter');
        diceNum.forEach(die => {
            die.addEventListener('click', () => {
                if (!devMode) return;
                const type = die.classList.contains('orange-die') ? 'day' : 'night';
                adjustPlayerDie(pNum, type, -1);
            });
        });

        // Setup hand slots
        const handSlots = container.querySelectorAll('.hand-slot');
        handSlots.forEach(slot => {
            slot.addEventListener('click', (e) => {
                e.stopPropagation();
                if (heldCards.length > 0) {
                    if (slot.classList.contains('slot-empty')) {
                        placeCard(slot);
                    } else {
                        cancelGrab(); // Return current hold before grabbing new one to prevent stacking
                        const cardData = JSON.parse(slot.dataset.cardData);
                        grabCard(cardData, slot);
                        clearSlot(slot);
                    }
                } else if (!slot.classList.contains('slot-empty')) {
                    // Aetherlab armed (Method A): clicking a glowing, upgradeable hand Steam trades it up.
                    if (!devMode && aetherlabActive && currentPhase === 1
                        && slot.classList.contains('aetherlab-upgradable')
                        && slot.closest('.player-zone')?.id === `player-${currentPlayer}`) {
                        tryAetherlabUpgradeHandSlot(slot);
                        return;
                    }
                    const cardData = JSON.parse(slot.dataset.cardData);

                    // Dark Matter: play from hand during your Construction Phase — draws a
                    // card, then a chosen opponent must pick one of three costs.
                    const isMyBoard = slot.closest('.player-zone')?.id === `player-${currentPlayer}`;
                    if (!devMode && isMyBoard && currentPhase === 1 && cardData.name === 'Dark Matter') {
                        triggerDarkMatter(cardData, slot);
                        return;
                    }

                    // Sleep Potion (Duality A1): play from hand in your Construction OR Creature
                    // Phase to deactivate a Creature or Landmark of your choice (an already
                    // face-down target is discarded instead).
                    if (!devMode && isMyBoard && (currentPhase === 1 || currentPhase === 2) && cardData.name === 'Sleep Potion') {
                        triggerSleepPotion(cardData, slot);
                        return;
                    }

                    // Lotus (Duality A2): play from hand in your Construction Phase to lay an
                    // extra Creature pad beside the middle slot (fills 1,3,0,4 in order).
                    if (!devMode && isMyBoard && currentPhase === 1 && cardData.name === 'Lotus') {
                        placeLotusPad(cardData, slot);
                        return;
                    }

                    // Creatures are click-summoned in the Creature Phase: the middle slot is the
                    // default field; extra Lotus pads host the additional Creatures.
                    if (!devMode && isMyBoard && currentPhase === 2 && cardData.type === 'Creature') {
                        summonCreatureToZone(cardData, slot);
                        return;
                    }

                    // Rush (Duality A3): play from hand in your Creature Phase to make one of your
                    // Creatures attack instantly (bypassing summoning sickness).
                    if (!devMode && isMyBoard && currentPhase === 2 && cardData.name === 'Rush') {
                        triggerRush(cardData, slot);
                        return;
                    }

                    grabCard(cardData, slot);
                    clearSlot(slot);
                }
            });
        });

        // Setup auto-drop zone
        const autoDrop = container.querySelector('.hand-auto-drop');
        if (autoDrop) {
            autoDrop.addEventListener('click', (e) => {
                e.stopPropagation();
                if (heldCards.length > 0) {
                    placeCard(autoDrop);
                }
            });
        }

        function handleStartGame() {
            if (gameStarted) return;
            gameStarted = true;
            if (startGameBtn) startGameBtn.remove();
            
            // Global initialization for the first player
            currentPlayer = 1;
            currentPhase = 0;
            
            const phaseUI = document.getElementById('game-phase-display');
            if (phaseUI) phaseUI.classList.remove('hidden');
            
            const gameField = document.getElementById('game-field');
            if (gameField) {
                gameField.className = `players-${activePlayerCount} turn-p${currentPlayer}`;
            }

            // Reset all boards active-player class
            document.querySelectorAll('.player-zone').forEach(z => z.classList.remove('active-player'));
            const myBoard = document.getElementById(`player-${currentPlayer}`);
            if (myBoard) myBoard.classList.add('active-player');
            
            const pLabel = document.getElementById('active-player-label');
            if (pLabel) pLabel.textContent = `PLAYER ${currentPlayer}`;
            
            // Initial layout for all players
            for (let i = 1; i <= activePlayerCount; i++) updateHandLayout(i);

            // Now that boards are visible and active, deal cards to ALL active players
            for (let i = 1; i <= activePlayerCount; i++) {
                const pBoard = document.getElementById(`player-${i}`);
                if (!pBoard) continue;
                
                const pFuturePile = pBoard.querySelector('.future-pile');
                const pHandSlots = Array.from(pBoard.querySelectorAll('.hand-slot'));
                
                if (pFuturePile && pFuturePile.dataset.cardData) {
                    let data = JSON.parse(pFuturePile.dataset.cardData);
                    if (Array.isArray(data) && data.length >= 3) {
                        const availableSlots = pHandSlots.filter(s => s.classList.contains('slot-empty')).slice(0, 3);
                        availableSlots.forEach((slot, idx) => {
                            const card = data.pop();
                            if (card) {
                                pFuturePile.dataset.cardData = JSON.stringify(data);
                                updateStackIndicator(pFuturePile);
                                // Animation ONLY for current active player (Player 1 usually)
                                if (i === currentPlayer) {
                                    animateCardDeal(pFuturePile, slot, card);
                                } else {
                                    // Silent placement for others
                                    slot.classList.remove('slot-empty');
                                    slot.dataset.cardData = JSON.stringify(card);
                                    updateHandLayout(i);
                                }
                            }
                        });
                    }
                }
            }

            updatePhaseUI();
        }

        // Setup Start Game button ONCE for Player 1
        const startGameBtn = container.querySelector('.start-game-btn');
        if (pNum !== 1 && startGameBtn) {
            startGameBtn.remove();
        } else if (startGameBtn) {
            startGameBtn.addEventListener('click', handleStartGame);
            window.handleStartGame = () => handleStartGame(); // Global reference
        }

        updatePlayerDieUI(pNum, 'day');
        updatePlayerDieUI(pNum, 'night');
    }

    function animateCardDeal(sourceEl, targetSlot, cardData) {
        const sourceRect = sourceEl.getBoundingClientRect();
        let targetRect = targetSlot.getBoundingClientRect();
        // Hidden hand slots (an inactive board's hand) have no layout box —
        // aim the flight at the board's card-back fan instead.
        if (!targetRect.width && !targetRect.height) {
            const fan = targetSlot.closest('.player-zone')?.querySelector('.inactive-hand-display');
            if (fan) targetRect = fan.getBoundingClientRect();
        }
        
        const ghost = document.createElement('div');
        ghost.className = 'held-card-ghost';
        ghost.style.left = sourceRect.left + 'px';
        ghost.style.top = sourceRect.top + 'px';
        ghost.style.zIndex = '1000';
        
        // Start face-down
        const backImg = (cardData.type === 'Destiny' || cardData.location === 'D' || cardData.location === 'DA') ? 'destiny_back.png' : 'card_back.png';
        ghost.style.backgroundImage = `url('assets/${backImg}')`;
        
        document.body.appendChild(ghost);
        
        // Force layout
        ghost.offsetHeight;
        
        ghost.style.transition = 'all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)';
        ghost.style.left = targetRect.left + 'px';
        ghost.style.top = targetRect.top + 'px';
        ghost.style.transform = 'scale(1.3) rotate(0deg)'; // Hand slots are slightly larger

        setTimeout(() => {
            ghost.remove();
            targetSlot.classList.remove('slot-empty');
            targetSlot.dataset.cardData = JSON.stringify(cardData);
            
            const art = cardArtUrl(cardData);
            if (art) {
                targetSlot.style.backgroundImage = `url('${art}')`;
            } else {
                targetSlot.style.backgroundImage = '';
                targetSlot.style.backgroundColor = 'rgba(255,255,255,0.1)';
                targetSlot.textContent = cardData.name;
            }
            bindHoverToElement(targetSlot, cardData);
            if (window.updateBazaarLighting) window.updateBazaarLighting();
            
            // Sync hand layout/count
            const board = targetSlot.closest('.player-zone');
            if (board) {
                const pNum = board.id.split('-')[1];
                updateHandLayout(pNum);
            }
        }, 600);
    }

    function createSlot(type, isMiddle = false) {
        const slot = document.createElement('div');
        slot.className = 'card slot-empty' + (isMiddle ? ' middle-slot' : '');
        slot.dataset.type = type;
        if (type === 'hand') slot.classList.add('hand-slot');
        if (type === 'atlantica') slot.classList.add('atlantica-slot');
        
        slot.addEventListener('click', (e) => {
            e.stopPropagation();
            if (heldCards.length > 0) {
                placeCard(slot);
            } else if (!slot.classList.contains('slot-empty') && !slot.classList.contains('history-pile')) {
                const cardData = JSON.parse(slot.dataset.cardData);
                
                // Add Attack logic here
                const isCreatureZone = slot.parentNode && slot.parentNode.classList.contains('creature-zone-main');
                const isMyBoard = slot.closest('.player-zone') && slot.closest('.player-zone').id === `player-${currentPlayer}`;

                // Deactivated cards lie face down: your own can be unveiled by clicking;
                // an opponent's face-down card is not interactable at all.
                if (!devMode && cardData.deactivated &&
                    (isCreatureZone || (slot.parentNode && slot.parentNode.classList.contains('landmark-zone-main')))) {
                    // Masiota's self-rescue can't be undone in the same turn it happened.
                    if (isMyBoard && cardData.name === 'Masiota' &&
                        cardData.masiotaRescueStamp === `${totalTurns}-${currentPlayer}`) {
                        alert('Masiota can be reactivated next turn.');
                        return;
                    }
                    if (isMyBoard && confirm(`Unveil ${cardData.name}? It flips face up and reactivates.`)) {
                        reactivateCard(slot);
                    }
                    return;
                }

                // Chrona (Duality C1): while it's still the turn it entered the Creature Zone,
                // clicking it redistributes its Health Points between Strength and Resistance
                // (1⚔/3⛨ → 2/2 → 3⚔/1⛨, wrapping — never 0 on either side). From the next
                // turn on the split is locked and clicks behave normally.
                if (!devMode && isCreatureZone && isMyBoard && cardData.name === 'Chrona' &&
                    cardData.summonedOnTurn === totalTurns) {
                    cycleChronaSplit(slot, cardData);
                    return;
                }

                if (!devMode && isCreatureZone && isMyBoard && currentPhase === 2) {
                    // It's the Creature Phase and my creature - Try to attack
                    if (cardData.summonedOnTurn < totalTurns || cardData.name.includes("Cravus") || cardData.name.includes("Rampadon")) {
                         showAttackMenu(cardData, slot);
                    } else {
                         alert("Summoning sickness! This creature can attack next turn.");
                    }
                    return;
                }

                // Aetherlab: toggle upgrade mode (Construction Phase only, once per phase)
                const isLandmarkZone = slot.parentNode && slot.parentNode.classList.contains('landmark-zone-main');
                if (!devMode && isLandmarkZone && isMyBoard && currentPhase === 1 && cardData.name === 'Aetherlab') {
                    toggleAetherlab();
                    return;
                }

                // Lethargo's Temple: toggle TP-buy mode (Construction Phase only, once per phase)
                if (!devMode && isLandmarkZone && isMyBoard && currentPhase === 1 && cardData.name === "Lethargo's Temple") {
                    toggleLethargo();
                    return;
                }

                // Time Bender: switch your active Time Die (Construction Phase, once per phase).
                if (!devMode && isLandmarkZone && isMyBoard && currentPhase === 1 && cardData.name === 'Time Bender') {
                    activateTimeBender();
                    return;
                }

                // Hand of Rhone: open the Force context window (Construction Phase).
                if (!devMode && isLandmarkZone && isMyBoard && currentPhase === 1 && cardData.name === 'Hand of Rhone') {
                    toggleRhoneContext();
                    return;
                }

                // Repo Station: sacrifice one of your Creatures for 1 TP (Construction or Creature Phase).
                if (!devMode && isLandmarkZone && isMyBoard && (currentPhase === 1 || currentPhase === 2) && cardData.name === 'Repo Station') {
                    activateRepoStation();
                    return;
                }

                // Mines of Pyralos: send a card into the Abyss to rearrange a Future Pile's
                // top 6, then draw (Construction Phase, once per phase).
                if (!devMode && isLandmarkZone && isMyBoard && currentPhase === 1 && cardData.name === 'Mines of Pyralos') {
                    activateMines();
                    return;
                }

                // Clone Factory: discard a GoldSteam to attack twice in a row (Creature Phase).
                if (!devMode && isLandmarkZone && isMyBoard && currentPhase === 2 && cardData.name === 'Clone Factory') {
                    activateCloneFactory();
                    return;
                }

                // If not attacking, lift card (except locked creatures handled by grabCard)
                grabCard(cardData, slot);
                if (heldCards.length > 0 && heldCardSources.includes(slot)) {
                    clearSlot(slot);
                }
            }
        });
        
        slot.addEventListener('mouseenter', () => {
            if (slot.classList.contains('slot-empty')) clearTimeout(hoverTimer);
        });

        // Dev Mode: double-click a board card to flip it face down (deactivate) and back —
        // the test path for the deactivation subsystem until Sleep Potion lands.
        slot.addEventListener('dblclick', () => {
            if (!devMode || slot.classList.contains('slot-empty') || !slot.dataset.cardData) return;
            let c;
            try { c = JSON.parse(slot.dataset.cardData); } catch (e) { return; }
            if (Array.isArray(c)) return;
            if (!c.deactivated && !canBeDeactivated(c)) { alert(`${c.name} cannot be deactivated.`); return; }
            c.deactivated = !c.deactivated;
            if (!c.deactivated) delete c.faceDownSecret;
            slot.dataset.cardData = JSON.stringify(c);
            syncFaceDownVisual(slot);
            refreshBoardAfterDeactivation(slot);
        });

        return slot;
    }

    function clearSlot(slot) {
        slot.classList.add('slot-empty');
        slot.style.backgroundImage = '';
        slot.style.backgroundColor = '';
        slot.textContent = '';
        delete slot.dataset.cardData;

        if (slot.classList.contains('temporary-slot')) {
            slot.remove();
        }
        
        // Find which player board this belongs to and update layout
        const board = slot.closest('.player-zone');
        if (board) {
            const pNum = board.id.split('-')[1];
            updateHandLayout(pNum);

            // Removing a Landmark discards its Atlantica-connected card (and hides
            // the extended-hand row when Atlantica itself leaves play).
            if (slot.parentNode && slot.parentNode.classList.contains('landmark-zone-main')) {
                syncAtlanticaZone(parseInt(pNum));
            }
        }

        checkHandLimit();
    }

    function createStackSlot(labelTxt, pileClass) {
        const slot = document.createElement('div');
        slot.className = `card slot-empty stack-field ${pileClass}`;
        const label = document.createElement('div');
        label.className = 'pile-label tech-font';
        label.textContent = labelTxt;
        slot.appendChild(label);
        
        slot.addEventListener('click', (e) => {
            e.stopPropagation();
            if (heldCards.length > 0) {
                placeCard(slot);
            } else if (!slot.classList.contains('slot-empty') && !slot.classList.contains('history-pile')) {
                // Lift card from stack
                const data = JSON.parse(slot.dataset.cardData);
                let cardToGrab;
                
                if (Array.isArray(data)) {
                    cardToGrab = data.pop();
                    if (data.length === 0) {
                        delete slot.dataset.cardData;
                        clearStackSlot(slot, labelTxt);
                    } else {
                        slot.dataset.cardData = JSON.stringify(data);
                        // Update visual to new top card (for History) or maintain back (for Future)
                        const newTop = data[data.length - 1];
                        if (slot.classList.contains('history-pile')) {
                            const art = cardArtUrl(newTop);
                            if (art) {
                                slot.style.backgroundImage = `url('${art}')`;
                            } else {
                                slot.style.backgroundImage = '';
                                slot.style.backgroundColor = 'rgba(255,255,255,0.1)';
                                slot.textContent = newTop.name;
                            }
                        }
                        bindHoverToElement(slot, newTop);
                        updateStackIndicator(slot);
                    }
                } else {
                    cardToGrab = data;
                    delete slot.dataset.cardData;
                    clearStackSlot(slot, labelTxt);
                }
                
                grabCard(cardToGrab, slot);
            }
        });
        return slot;
    }

    function clearStackSlot(slot, originalLabel) {
        slot.classList.add('slot-empty');
        slot.style.backgroundImage = '';
        slot.style.backgroundColor = '';
        slot.innerHTML = ''; // Clear label or card text
        const label = document.createElement('div');
        label.className = 'pile-label tech-font';
        label.textContent = originalLabel;
        slot.appendChild(label);
        delete slot.dataset.cardData;
    }



    function grabCard(card, sourceEl = null) {
        // Restriction: Creatures in Creature Zone cannot be grabbed (bypassed in Dev Mode)
        if (!devMode && sourceEl && sourceEl.parentNode && sourceEl.parentNode.classList.contains('creature-zone-main')) {
            return;
        }

        // If grabbing from Bazaar/Source, ensures we don't accidentally stack with previous holds
        const isFromBazaar = sourceEl && sourceEl.dataset.loc && !sourceEl.closest('.player-zone');
        const isFromHand = sourceEl && sourceEl.classList.contains('hand-slot');

        if (!devMode && currentPhase === 3 && !isFromHand) {
            // Silently block non-hand grabs in End Phase
            return;
        }

        if (isFromBazaar) {
            heldCards = [];
            heldCardSources = [];
        }

        heldCards.push(card);
        heldCardSources.push(sourceEl);
        if (heldGhost) heldGhost.remove();
        
        // Show auto-drop buttons
        document.querySelectorAll('.hand-auto-drop').forEach(btn => btn.classList.remove('hidden'));

        updateHeldGhost();
        highlightValidZones(card);
    }

    function updateCreatureStatBadge(slot, card) {
        // Remove existing
        slot.querySelectorAll('.health-badge, .strength-badge').forEach(e => e.remove());
        
        if (!card || card.type !== 'Creature') return;

        // Strength Badge (Displays effectively current health/strength).
        // Prefer the live baseStrength (a placed creature always carries it, and
        // Chrona's split can move it off the printed value) over the printed stat.
        const baseStr = card.baseStrength !== undefined ? card.baseStrength : getBaseStrength(card);
        const permMod = card.permanentStrMod || 0;
        const isAttacker = slot.closest('.player-zone') && slot.closest('.player-zone').id === `player-${currentPlayer}`;
        const tempMod = isAttacker ? -activeStrDebuff : 0;
        const damage = card.damageTaken || 0;

        // Final value: (Base + Buffs - Debuffs) - Damage
        const finalVal = Math.max(0, (baseStr + permMod + tempMod) - damage);
        
        const sb = document.createElement('div');
        sb.className = 'strength-badge tech-font';
        sb.textContent = finalVal;
        
        // Use baseStr + permMod as comparison point for context
        if (finalVal < (baseStr + permMod)) sb.classList.add('negative');
        else if (finalVal > (baseStr + permMod)) sb.classList.add('positive');
        
        slot.appendChild(sb);
    }

    // --- Chrona (Duality C1): redistribute its Health Points on entry ---
    // The pool is Strength + Resistance (printed 2/2 = 4). Untouched it acts like Ichor;
    // each click walks the legal splits from 1 Strength upward: 1/3 → 2/2 → 3/1 → 1/3…
    // (0 on either side is not allowed). Only callable during the turn it was summoned.
    function cycleChronaSplit(slot, card) {
        const pool = getBaseStrength(card) + getBaseResistance(card);
        const splits = [];
        for (let s = 1; s <= pool - 1; s++) splits.push([s, pool - s]);
        const idx = card.chronaSplitIdx === undefined ? 0 : (card.chronaSplitIdx + 1) % splits.length;
        card.chronaSplitIdx = idx;
        card.baseStrength = splits[idx][0];
        card.baseResistance = splits[idx][1];
        slot.dataset.cardData = JSON.stringify(card);
        updateCreatureVisuals(slot);
        floatValue(slot, `⚔${card.baseStrength} / ⛨${card.baseResistance}`, 'gain');
    }

    function getBaseStrength(card) {
        let str = parseInt(card.strength ?? card.health) || 0;
        if (card.description && card.description.includes("Strength")) {
            const match = card.description.match(/Strength (\d+)/);
            if (match) str = parseInt(match[1]);
        }
        return str;
    }

    function getBaseResistance(card) {
        return parseInt(card.resistance ?? card.health) || 0;
    }

    function updateHeldGhost() {
        if (heldGhost) heldGhost.remove();
        if (heldCards.length === 0) return;

        heldGhost = document.createElement('div');
        heldGhost.className = 'held-card-stack-ghost';
        heldGhost.style.position = 'fixed';
        heldGhost.style.pointerEvents = 'none';
        heldGhost.style.zIndex = '100000';
        
        const visualCount = Math.min(heldCards.length, 3);
        const topIdx = heldCards.length - 1;
        
        for (let i = 0; i < visualCount; i++) {
            const card = heldCards[topIdx - i];
            const layer = document.createElement('div');
            layer.className = 'held-card-ghost';
            layer.style.position = 'absolute';
            layer.style.transform = `translate(${i * 6}px, ${i * -6}px)`;
            layer.style.zIndex = visualCount - i;
            
            const backImg = (card.type === 'Destiny' || card.location === 'D' || card.location === 'DA') ? 'destiny_back.png' : 'card_back.png';
            const art = cardArtUrl(card);
            if (art) {
                layer.style.backgroundImage = `url('${art}')`;
            } else {
                layer.style.backgroundImage = `url('assets/${backImg}')`;
                layer.style.backgroundColor = 'rgba(255,255,255,0.1)';
            }
            heldGhost.appendChild(layer);
        }
        document.body.appendChild(heldGhost);

        // Track mouse
        document.onmousemove = (e) => {
            if (heldGhost) {
                heldGhost.style.left = (e.clientX - 45) + 'px';
                heldGhost.style.top = (e.clientY - 60) + 'px';
            }
        };
    }

    function cancelGrab() {
        if (heldCards.length === 0) return;
        document.querySelectorAll('.hand-auto-drop').forEach(btn => btn.classList.add('hidden'));

        heldCards.forEach((card, idx) => {
            const sourceEl = heldCardSources[idx];
            if (sourceEl) {
                const rect = sourceEl.getBoundingClientRect();
                const tempGhost = document.createElement('div');
                tempGhost.className = 'held-card-ghost';
                tempGhost.style.position = 'fixed';
                tempGhost.style.left = (heldGhost.offsetLeft + idx * 6) + 'px';
                tempGhost.style.top = (heldGhost.offsetTop - idx * 6) + 'px';
                
                const cancelArt = cardArtUrl(card);
                if (cancelArt) tempGhost.style.backgroundImage = `url('${cancelArt}')`;
                else tempGhost.style.backgroundImage = `url('assets/card_back.png')`;

                document.body.appendChild(tempGhost);

                setTimeout(() => {
                    tempGhost.style.transition = 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
                    tempGhost.style.left = rect.left + 'px';
                    tempGhost.style.top = rect.top + 'px';
                    tempGhost.style.transform = 'scale(0.8)';
                    tempGhost.style.opacity = '0';
                    setTimeout(() => {
                        tempGhost.remove();
                        // If it came from bazaar, we just let it be (it was never removed)
                        if (sourceEl.dataset.loc) return;

                        sourceEl.classList.remove('slot-empty');
                        sourceEl.dataset.cardData = JSON.stringify(card);
                        if (sourceEl.classList.contains('hand-slot')) {
                            const art = cardArtUrl(card);
                            if (art) sourceEl.style.backgroundImage = `url('${art}')`;
                            else {
                                sourceEl.style.backgroundImage = '';
                                sourceEl.style.backgroundColor = 'rgba(255,255,255,0.1)';
                                sourceEl.textContent = card.name;
                            }
                        }
                        updateStackIndicator(sourceEl);
                        bindHoverToElement(sourceEl, card);
                        updateCreatureVisuals(sourceEl);
                    }, 400);
                }, 10);
            }
        });

        heldCards = [];
        heldCardSources = [];
        if (heldGhost) heldGhost.remove();
        heldGhost = null;
        clearHighlights();
        if (window.updateBazaarLighting) window.updateBazaarLighting();
    }

    function highlightValidZones(card) {
        clearHighlights();

        // Dev Mode: any card may go into any slot on any board (Bazaar excluded)
        if (devMode) {
            const devTargets = Array.from(document.querySelectorAll(
                '.player-zone .hand-slot.slot-empty, .player-zone .hand-auto-drop, ' +
                '.player-zone .creature-zone-main .card.slot-empty, ' +
                '.player-zone .landmark-zone-main .card.slot-empty, ' +
                '.player-zone .future-pile, .player-zone .history-pile, .card--abyss'
            ));
            devTargets.forEach(t => {
                const fire = document.createElement('div');
                fire.className = 'fire-spot fire-gold';
                t.appendChild(fire);
                t.classList.add('valid-drop-target');
            });
            return;
        }

        let targets = [];
        let color = 'white';
        const activeBoard = document.getElementById(`player-${currentPlayer}`);
        if (!activeBoard) return;

        if (card.type === 'Landmark') {
            targets = Array.from(activeBoard.querySelectorAll('.landmark-zone-main .card.slot-empty'));
            color = 'green';
        } else if (card.type === 'Artifact') {
            // Artifacts from bazaar go ONLY to the History pile
            targets = Array.from(activeBoard.querySelectorAll('.history-pile'));
            color = 'purple';
        } else if (card.type === 'Creature') {
            targets = Array.from(activeBoard.querySelectorAll('.hand-slot.slot-empty, .hand-auto-drop'));
            if (currentPhase === 1 || currentPhase === 2) {
                // The middle slot is the only valid default Creature field; extra slots come
                // from Lotus pads, which are filled by click-summoning rather than dragging.
                const zones = Array.from(activeBoard.querySelectorAll('.creature-zone-main .middle-slot.slot-empty'));
                targets = targets.concat(zones);
            }
            color = 'blue';
        } else if (card.type === 'Spark') {
            // Sparks ONLY to Abyss
            targets = Array.from(document.querySelectorAll('.card--abyss'));
            color = 'white'; 
        } else {
            // Steam etc to hand
            targets = Array.from(activeBoard.querySelectorAll('.hand-slot.slot-empty, .hand-auto-drop'));
            // Aetherlab (Method B): a held Steam can also be dropped on its own drawer or the
            // next-tier drawer in the Bazaar to trade up. Light those drawers as drop targets.
            const upSpec = AETHERLAB_UPGRADE[card.number];
            if (aetherlabReady() && upSpec && bazaarHasSteam(upSpec.toLoc)) {
                upSpec.validDrawers.forEach(loc => {
                    const drawer = document.querySelector(`.bazaar-area .card[data-loc="${loc}"]`);
                    if (drawer) { targets.push(drawer); drawer.classList.add('aetherlab-drop-target'); }
                });
            }
        }

        // Atlantica: empty extended-hand slots behind your active Landmarks accept any
        // card that could sit in Hand (Construction Phase, like the parking action itself).
        if (card.type !== 'Spark' && card.type !== 'Landmark' && currentPhase === 1) {
            usableAtlanticaSlots(currentPlayer)
                .filter(s => s.classList.contains('slot-empty'))
                .forEach(s => { if (!targets.includes(s)) targets.push(s); });
        }

        // EVERY non-spark, non-steam card can now be added to Future or History as requested
        if (card.type !== 'Spark' && card.type !== 'Steam') {
            const universalTargets = Array.from(activeBoard.querySelectorAll('.future-pile, .history-pile'));
            universalTargets.forEach(t => {
                if (!targets.includes(t)) targets.push(t);
            });
        }

        targets.forEach(t => {
            const fire = document.createElement('div');
            fire.className = `fire-spot fire-${color}`;
            t.appendChild(fire);
            t.classList.add('valid-drop-target');
        });

        // Direct landmark selection (Path 2): also light up any landmark that could
        // consume this card. Dropping onto it discards the card to History and fires
        // that specific landmark — the explicit alternative to the History drop.
        getDiscardLandmarkOptions(card).forEach(opt => {
            const el = findLandmark(currentPlayer, opt.name);
            if (el && !el.classList.contains('valid-drop-target')) {
                const fire = document.createElement('div');
                fire.className = 'fire-spot fire-green';
                el.appendChild(fire);
                el.classList.add('valid-drop-target', 'landmark-consume-target');
            }
        });
    }

    function clearHighlights() {
        document.querySelectorAll('.fire-spot').forEach(f => f.remove());
        document.querySelectorAll('.valid-drop-target').forEach(t => t.classList.remove('valid-drop-target'));
        document.querySelectorAll('.landmark-consume-target').forEach(t => t.classList.remove('landmark-consume-target'));
        document.querySelectorAll('.aetherlab-drop-target').forEach(t => t.classList.remove('aetherlab-drop-target'));
    }

    function placeCard(targetSlot) {
        if (heldCards.length === 0) return;
        
        const isFuture = targetSlot.classList.contains('future-pile');
        const isHistory = targetSlot.classList.contains('history-pile');
        const isAbyss = targetSlot.classList.contains('card--abyss');
        const isStack = isFuture || isHistory || isAbyss;
        const isHand = targetSlot.classList.contains('hand-slot');
        const isAutoDrop = targetSlot.classList.contains('hand-auto-drop');
        const isCreatureZone = targetSlot.parentNode && targetSlot.parentNode.classList.contains('creature-zone-main');
        const isLandmarkZone = targetSlot.parentNode && targetSlot.parentNode.classList.contains('landmark-zone-main');
        const isHandAction = isHand || isAutoDrop;

        const topCard = heldCards[0];

        // Direct landmark selection (Path 2): dropping a card onto a glowing landmark
        // discards it to History and fires THAT landmark's effect. Bypasses the normal
        // placement/validity flow because the target is an occupied landmark, not a slot.
        if (targetSlot.classList.contains('landmark-consume-target')) {
            const landmarkName = (() => {
                try { return JSON.parse(targetSlot.dataset.cardData).name; } catch (e) { return null; }
            })();
            const activeBoard = document.getElementById(`player-${currentPlayer}`);
            const histPile = activeBoard && activeBoard.querySelector('.history-pile');
            if (histPile && landmarkName) {
                const c = heldCards.shift();
                heldCardSources.shift();
                finishSingleCardPlacement(histPile, c); // discard to History (source hand slot already cleared on grab)
                fireLandmarkByName(landmarkName, c);
            }

            if (heldCards.length === 0) {
                document.querySelectorAll('.hand-auto-drop').forEach(btn => btn.classList.add('hidden'));
                if (heldGhost) heldGhost.remove();
                heldGhost = null;
                document.onmousemove = null;
                clearHighlights();
            } else {
                updateHeldGhost();
                highlightValidZones(heldCards[0]);
            }
            if (window.updateBazaarLighting) window.updateBazaarLighting();
            consolidateHand(currentPlayer);
            return;
        }

        const isAtlantica = targetSlot.classList.contains('atlantica-slot');

        let isValid = false;
        if (topCard.type === 'Spark') {
            isValid = isAbyss; // ONLY Abyss for Spark
        } else {
            // Non-Sparks can go to stacks (Future/History) OR their specialized zones, but NOT Abyss here
            isValid = isFuture || isHistory ||
                      (topCard.type === 'Landmark' && isLandmarkZone) ||
                      (topCard.type === 'Artifact' && (isHistory || isHandAction)) ||
                      (topCard.type === 'Creature' && (isHandAction || isCreatureZone)) ||
                      (topCard.type === 'Steam' && isHandAction) ||
                      // Atlantica: park behind an active Landmark (extended hand, 1 per Landmark)
                      (topCard.type !== 'Landmark' && isAtlantica &&
                       usableAtlanticaSlots(currentPlayer).includes(targetSlot));
        }

        // Dev Mode allows any non-Bazaar slot as a valid target
        if (devMode) {
            isValid = isStack || isHandAction || isCreatureZone || isLandmarkZone;
        }

        if (!isValid) return;



        // Phase specific restrictions for zones (bypassed in Dev Mode)
        if (!devMode && isCreatureZone && (currentPhase !== 1 && currentPhase !== 2)) return;
        if (!devMode && isLandmarkZone && currentPhase !== 1) return;
        if (!devMode && isAtlantica && currentPhase !== 1) return;

        if (isAutoDrop) {
            const handSlotsContainer = targetSlot.closest('.player-zone').querySelector('.hand-slots');
            let firstEmptyArr = Array.from(handSlotsContainer.querySelectorAll('.hand-slot.slot-empty'));
            let firstEmpty = firstEmptyArr[0];
            
            if (!firstEmpty) {
                firstEmpty = createSlot('hand');
                firstEmpty.classList.add('temporary-slot');
                handSlotsContainer.appendChild(firstEmpty);
            }
            targetSlot = firstEmpty;
        }

        // Prevent overwriting occupied non-stack slots
        if (!isStack && !targetSlot.classList.contains('slot-empty')) return;

        // Perform move - remove from Bazaar if that's where it originated
        const sourceEl = heldCardSources[0];
        const isFromBazaar = sourceEl && sourceEl.dataset.loc && !sourceEl.closest('.player-zone');
        const isFromHand = sourceEl && sourceEl.classList.contains('hand-slot');
        const activeBoard = document.getElementById(`player-${currentPlayer}`);
        const isToActiveBoard = targetSlot.closest('.player-zone') === activeBoard;

        // ONLY pay if originating from Bazaar (Buying) — Dev Mode takes cards for free
        if (!devMode && isFromBazaar && topCard.cost) {
            if (currentPhase === 3) return; // Cannot buy during End Phase
            
            // Restriction: Only 1 Steam total per turn from Bazaar
            if (topCard.type === 'Steam') {
                if (steamBoughtThisTurn) return; // Silent block (no more alerts)
                steamBoughtThisTurn = true;
            }

            // Lethargo's Temple: when armed, non-Steam buys are paid in Steam+TP (or Only TP).
            if (lethargoActive && currentPhase === 1 && topCard.type !== 'Steam') {
                payWithLethargo(topCard);
            } else {
                autoPayCost(topCard);
            }
        }

        if (!devMode && currentPhase === 3 && !isHistory && !isHandAction) {
            // End Phase only allows discarding to History or putting card back to Hand
            return;
        }

        function removeFromBazaar(source, cardData) {
            const loc = source.dataset.loc;
            if (loc && activeBazaar[loc]) {
                const idx = activeBazaar[loc].findIndex(c => c.name === cardData.name);
                if (idx !== -1) {
                    activeBazaar[loc].splice(idx, 1);
                    renderBazaar();
                }
            }
        }

        // Drop Logic
        if (heldCards.length > 1 && isHand) {
            const hand = targetSlot.closest('.hand-slots');
            const slots = Array.from(hand.querySelectorAll('.hand-slot'));
            const startIndex = slots.indexOf(targetSlot);
            
            let placedCount = 0;
            const currentHoldLength = heldCards.length;
            for (let i = startIndex; i < slots.length && placedCount < currentHoldLength; i++) {
                if (slots[i].classList.contains('slot-empty')) {
                    const c = heldCards[0];
                    const s = heldCardSources[0];
                    if (s && s.dataset.loc) removeFromBazaar(s, c);
                    
                    finishSingleCardPlacement(slots[i], c);
                    heldCards.shift();
                    heldCardSources.shift();
                    placedCount++;
                }
            }
        } else if (isStack) {
            while(heldCards.length > 0) {
                const c = heldCards.shift();
                const s = heldCardSources.shift();
                if (s && s.dataset.loc) removeFromBazaar(s, c);
                finishSingleCardPlacement(targetSlot, c);
            }
        } else {
            const c = heldCards.shift();
            const s = heldCardSources.shift();
            if (s && s.dataset.loc) removeFromBazaar(s, c);
            finishSingleCardPlacement(targetSlot, c);
        }

        // Landmarks triggered by discarding a card into your own History (Catalyst /
        // Wasteland / Planetarium), disambiguated by phase + type inside the coordinator.
        if (isHistory && isToActiveBoard) resolveHistoryDiscard(topCard);

        // Sparks resolve their effect the instant they land in the Abyss — that drop IS
        // the "play" gesture (manual enforcement: the player pulls the trigger themselves).
        if (isAbyss && topCard.type === 'Spark') resolveSparkEffect(currentPlayer, topCard);

        if (heldCards.length === 0) {
            document.querySelectorAll('.hand-auto-drop').forEach(btn => btn.classList.add('hidden'));
            if (heldGhost) heldGhost.remove();
            heldGhost = null;
            document.onmousemove = null;
            clearHighlights();
        } else {
            updateHeldGhost();
            highlightValidZones(heldCards[0]);
        }
        
        if (window.updateBazaarLighting) window.updateBazaarLighting();
        
        const board = targetSlot.closest('.player-zone');
        if (board) {
            const pNum = board.id.split('-')[1];
            consolidateHand(pNum);
        } else {
            checkHandLimit(); 
        }

        // Auto-end Steam Phase (0) after a purchase from Bazaar placed into hand
        if (currentPhase === 0 && isFromBazaar && topCard.type === 'Steam' && isHandAction) {
            setTimeout(progressPhase, 700);
        }
    }

    // --- Deactivation subsystem: face-down cards ---
    // A deactivated card lies FACE DOWN on the board (full mystery, per Simon's design) and
    // grants no effects. card.deactivated = true renders the card back; card.faceDownSecret
    // marks a secret placement (e.g. a Sleep-Potioned Creature entering the zone) that ONLY
    // its owner may hover-peek. Without the secret flag the card was seen before it flipped
    // (e.g. an opponent's Landmark), so anyone may hover-peek the front in a dimmed state.
    // Atlantica and Razo can never be deactivated (printed rule).
    function canBeDeactivated(card) {
        return card && card.name !== 'Atlantica' && card.name !== 'Razo';
    }

    function syncFaceDownVisual(slot) {
        if (!slot || slot.classList.contains('slot-empty') || !slot.dataset.cardData) return;
        let card;
        try { card = JSON.parse(slot.dataset.cardData); } catch (e) { return; }
        if (Array.isArray(card)) return; // stacks render their own faces
        if (card.deactivated) {
            slot.classList.add('card-deactivated');
            slot.style.backgroundImage = "url('assets/card_back.png')";
            slot.style.backgroundColor = 'transparent';
            slot.textContent = '';
            slot.querySelectorAll('.creature-stat-badge, .health-badge, .str-marker, .rhone-badge').forEach(b => b.remove());
        } else {
            slot.classList.remove('card-deactivated');
            const art = cardArtUrl(card);
            if (art) {
                slot.style.backgroundImage = `url('${art}')`;
                slot.style.backgroundColor = 'transparent';
                slot.textContent = '';
            } else {
                slot.style.backgroundImage = '';
                slot.style.backgroundColor = 'rgba(255,255,255,0.1)';
                slot.textContent = card.name;
            }
            updateCreatureVisuals(slot);
        }
    }

    function reactivateCard(slot) {
        let card;
        try { card = JSON.parse(slot.dataset.cardData); } catch (e) { return; }
        delete card.deactivated;
        delete card.faceDownSecret;
        // Masiota: reactivating after a rescue costs 1 Health Point per rescue so far
        // (printed 3 → 2 → 1), fully healed at the reduced ceiling.
        if (card.name === 'Masiota' && card.masiotaUses) {
            const hp = (parseInt(card.health) || 3) - card.masiotaUses;
            card.baseStrength = hp;
            card.baseResistance = hp;
            card.damageTaken = 0;
            slot.dataset.cardData = JSON.stringify(card);
            syncFaceDownVisual(slot);
            floatValue(slot, `Reactivated — ${hp} HP`, 'gain');
            refreshBoardAfterDeactivation(slot);
            return;
        }
        slot.dataset.cardData = JSON.stringify(card);
        syncFaceDownVisual(slot);
        floatValue(slot, 'Unveiled', 'gain');
        refreshBoardAfterDeactivation(slot);
    }

    // --- Masiota (Duality C4): "Instead of discarding, you may choose to deactivate Masiota." ---
    // Whenever he would leave the Creature Zone for History (defeated in combat, after his own
    // attack, or sacrificed), his owner may flip him face down in place instead. Reactivating
    // him — next turn at the earliest — reduces his Health Points by 1 per rescue so far, so
    // 3 HP allows two rescues; a rescue that would reactivate him at 0 HP isn't offered.
    // Returns true if rescued (the caller skips the discard).
    function maybeMasiotaRescue(slot, card) {
        if (!card || card.name !== 'Masiota' || card.deactivated) return false;
        const printed = parseInt(card.health) || 3;
        const uses = card.masiotaUses || 0;
        if (printed - (uses + 1) < 1) return false; // would come back at 0 HP — no rescue
        const board = slot.closest('.player-zone');
        const owner = board ? parseInt(board.id.split('-')[1]) : currentPlayer;
        if (vsComputer && owner === AI_PLAYER) return false; // V1: the Computer doesn't rescue
        if (!confirm(`Deactivate Masiota instead of discarding? He reactivates next turn at ${printed - (uses + 1)} HP.`)) return false;
        card.masiotaUses = uses + 1;
        card.masiotaRescueStamp = `${totalTurns}-${currentPlayer}`; // blocks same-turn reactivation
        card.deactivated = true;
        card.damageTaken = 0;
        slot.dataset.cardData = JSON.stringify(card);
        syncFaceDownVisual(slot);
        refreshBoardAfterDeactivation(slot);
        floatValue(slot, 'Deactivated', 'gain');
        return true;
    }

    // (De)activating a card can move board-wide state — a buffing Landmark's creature
    // badges (Meridia's Cabin) or the hand limit (Pandorama). Re-sync both.
    function refreshBoardAfterDeactivation(slot) {
        const board = slot.closest('.player-zone');
        if (board) {
            board.querySelectorAll('.creature-zone-main .card:not(.slot-empty)').forEach(s => updateCreatureVisuals(s));
            syncAtlanticaZone(parseInt(board.id.split('-')[1]));
        }
        checkHandLimit();
    }

    // --- Sleep Potion (Duality A1): the deactivator ---
    // "In your Construction Phase or Creature Phase: You may deactivate a Creature or a
    // Landmark of your choice. (If you target a deactivated Card, it gets discarded.) (You
    // may deactivate your Creature to keep it anonymous when bringing it into battle.)"
    // A card that is already face down is a legal target too — targeting it discards it
    // (Simon's confirmed double-deactivation = discard rule). Deactivating your OWN Creature
    // makes it a secret placement (faceDownSecret) so the opponent can't peek it.
    function sleepPotionTargets() {
        const found = [];
        for (let p = 1; p <= activePlayerCount; p++) {
            const board = document.getElementById(`player-${p}`);
            if (!board) continue;
            board.querySelectorAll('.creature-zone-main .card:not(.slot-empty), .landmark-zone-main .card:not(.slot-empty)').forEach(slot => {
                let c; try { c = JSON.parse(slot.dataset.cardData); } catch (e) { return; }
                if (Array.isArray(c)) return;
                // Eligible if it's already asleep (→ discard) or it can be put to sleep.
                if (c.deactivated || canBeDeactivated(c)) found.push({ slot, owner: p });
            });
        }
        return found;
    }

    function triggerSleepPotion(sleepCard, handSlot) {
        const targets = sleepPotionTargets();
        if (!targets.length) {
            alert('Sleep Potion — no Creature or Landmark can be targeted right now.');
            return;
        }

        const bar = document.createElement('div');
        bar.id = 'sleep-potion-bar';
        bar.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:6000;';
        const hint = document.createElement('div');
        hint.className = 'menu-btn tech-font';
        hint.style.cssText = 'pointer-events:none;opacity:0.85;';
        hint.textContent = 'SLEEP POTION — CHOOSE A CREATURE OR LANDMARK';
        bar.appendChild(hint);
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'menu-btn secondary-btn';
        cancelBtn.textContent = 'CANCEL';
        bar.appendChild(cancelBtn);
        document.body.appendChild(bar);

        const cleanup = () => {
            targets.forEach(t => {
                t.slot.classList.remove('sleep-target');
                if (t.slot._sleepHandler) t.slot.removeEventListener('click', t.slot._sleepHandler, true);
                delete t.slot._sleepHandler;
            });
            bar.remove();
        };
        cancelBtn.onclick = cleanup; // Sleep Potion stays in hand, nothing happens

        targets.forEach(t => {
            t.slot.classList.add('sleep-target');
            const handler = (e) => {
                e.stopPropagation();
                e.preventDefault();
                cleanup();
                resolveSleepPotion(t.slot, t.owner, sleepCard, handSlot);
            };
            t.slot._sleepHandler = handler;
            t.slot.addEventListener('click', handler, true); // capture: preempt the normal card click
        });
    }

    function resolveSleepPotion(targetSlot, ownerNum, sleepCard, handSlot) {
        let target; try { target = JSON.parse(targetSlot.dataset.cardData); } catch (e) { return; }
        const ownerBoard = document.getElementById(`player-${ownerNum}`);
        const ownerHistory = ownerBoard.querySelector('.history-pile');

        if (target.deactivated) {
            // Already asleep → discard it to its owner's History (a discarded Landmark cycles
            // and rebuilds itself on draw, exactly like a Hyperscope-destroyed one).
            floatValue(targetSlot, `${target.name} Discarded`, 'damage');
            clearSlot(targetSlot);
            finishSingleCardPlacement(ownerHistory, target);
        } else {
            target.deactivated = true;
            // Your own Creature goes down as a secret (anonymous) placement; opponents' cards
            // and any Landmark were already seen, so they stay peekable while asleep.
            if (target.type === 'Creature' && ownerNum === currentPlayer) target.faceDownSecret = true;
            targetSlot.dataset.cardData = JSON.stringify(target);
            syncFaceDownVisual(targetSlot);
            refreshBoardAfterDeactivation(targetSlot);
            floatValue(targetSlot, 'Deactivated', 'gain');
        }

        // Spend Sleep Potion to the caster's History (Artifacts return to History after use).
        const casterHistory = document.getElementById(`player-${currentPlayer}`).querySelector('.history-pile');
        clearSlot(handSlot);
        finishSingleCardPlacement(casterHistory, sleepCard);
        updateHandLayout(currentPlayer);
    }

    // --- Lotus (Duality A2): an Artifact pad that hosts an additional Creature ---
    // "Lay Lotus next to the center of your Creature Zone; place an additional Creature on it;
    // when that Creature is defeated or sacrificed, Lotus is discarded too." Per Simon: the
    // middle slot is the only default Creature field, and Lotus pads fill the slots beside it
    // in the order left-adjacent, right-adjacent, outer-left, outer-right (indices 1,3,0,4).
    const LOTUS_SLOT_ORDER = [1, 3, 0, 4];

    function placeLotusPad(lotusCard, handSlot) {
        const board = document.getElementById(`player-${currentPlayer}`);
        const slots = Array.from(board.querySelectorAll('.creature-zone-main .card'));
        const target = LOTUS_SLOT_ORDER.map(i => slots[i]).find(s => s && s.classList.contains('slot-empty'));
        if (!target) {
            alert('Lotus — no open Creature-Zone slot beside the middle.');
            return;
        }
        clearSlot(handSlot);
        finishSingleCardPlacement(target, lotusCard);
        floatValue(target, 'Lotus', 'gain');
        // An unoccupied Lotus counts as an Artifact in the zone for Meridia's Cabin — refresh.
        refreshBoardAfterDeactivation(target);
        updateHandLayout(currentPlayer);
    }

    // Click-summon a Creature: the middle slot by default; if it's taken, seat the additional
    // Creature ON the first open Lotus pad (the Lotus rides along on card.lotusPad so it can be
    // discarded with the Creature when it's defeated or sacrificed).
    function summonCreatureToZone(card, handSlot) {
        const board = document.getElementById(`player-${currentPlayer}`);
        const slots = Array.from(board.querySelectorAll('.creature-zone-main .card'));
        const middle = slots[2];

        if (middle.classList.contains('slot-empty')) {
            clearSlot(handSlot);
            finishSingleCardPlacement(middle, card);
            checkMeridiaZeroHp(middle, card);
            updateHandLayout(currentPlayer);
            return;
        }

        for (const idx of LOTUS_SLOT_ORDER) {
            const s = slots[idx];
            if (!s || s.classList.contains('slot-empty')) continue;
            let pad; try { pad = JSON.parse(s.dataset.cardData); } catch (e) { continue; }
            if (pad && pad.type === 'Artifact' && pad.name === 'Lotus' && !pad.deactivated) {
                const creature = { ...card, lotusPad: pad };
                clearSlot(s);
                finishSingleCardPlacement(s, creature);
                checkMeridiaZeroHp(s, creature);
                clearSlot(handSlot);
                updateHandLayout(currentPlayer);
                return;
            }
        }
        alert('No open Creature field — the middle slot is taken. Play Lotus for an extra slot.');
    }

    // --- Rush (Duality A3): make a Creature attack instantly ---
    // "In your Creature Phase: Make a Creature attack instantly." Played from hand: pick one of
    // your face-up Creatures (auto if there's only one), spend Rush to History, then open that
    // Creature's attack — stamping summonedOnTurn so the summoning-sickness gate is bypassed for
    // the rest of the turn (so a cancelled attack can still be retried by clicking it).
    function triggerRush(rushCard, handSlot) {
        const board = document.getElementById(`player-${currentPlayer}`);
        const creatures = Array.from(board.querySelectorAll('.creature-zone-main .card:not(.slot-empty)')).filter(s => {
            try { const c = JSON.parse(s.dataset.cardData); return c.type === 'Creature' && !c.deactivated; } catch (e) { return false; }
        });
        if (!creatures.length) { alert('Rush — you have no Creature in play to attack.'); return; }

        const apply = (slot) => {
            const casterHistory = board.querySelector('.history-pile');
            clearSlot(handSlot);
            finishSingleCardPlacement(casterHistory, rushCard);
            updateHandLayout(currentPlayer);
            rushCreature(slot);
        };

        if (creatures.length === 1) { apply(creatures[0]); return; }

        // Several Creatures — pulse them and let the player pick which one rushes.
        const bar = document.createElement('div');
        bar.id = 'rush-bar';
        bar.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:6000;';
        const hint = document.createElement('div');
        hint.className = 'menu-btn tech-font';
        hint.style.cssText = 'pointer-events:none;opacity:0.85;';
        hint.textContent = 'RUSH — CHOOSE A CREATURE TO ATTACK';
        bar.appendChild(hint);
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'menu-btn secondary-btn';
        cancelBtn.textContent = 'CANCEL';
        bar.appendChild(cancelBtn);
        document.body.appendChild(bar);

        const cleanup = () => {
            creatures.forEach(s => {
                s.classList.remove('threat-target');
                if (s._rushHandler) s.removeEventListener('click', s._rushHandler, true);
                delete s._rushHandler;
            });
            bar.remove();
        };
        cancelBtn.onclick = cleanup; // Rush stays in hand

        creatures.forEach(s => {
            s.classList.add('threat-target');
            const handler = (e) => {
                e.stopPropagation();
                e.preventDefault();
                cleanup();
                apply(s);
            };
            s._rushHandler = handler;
            s.addEventListener('click', handler, true); // capture: preempt the normal attack click
        });
    }

    function rushCreature(slot) {
        let card; try { card = JSON.parse(slot.dataset.cardData); } catch (e) { return; }
        card.summonedOnTurn = 0; // bypass summoning sickness for the rest of this turn
        slot.dataset.cardData = JSON.stringify(card);
        floatValue(slot, 'Rush!', 'gain');
        showAttackMenu(card, slot);
    }

    // --- Atlantica (Duality L6): an extended hand behind your Landmarks ---
    // While Atlantica is active you may park 1 Hand card face up behind each active
    // Landmark (the contextual .atlantica-zone row below the Landmark Zone). Parked cards
    // work just like Hand cards (they pay costs, can be grabbed and played) but don't
    // count against the Hand Limit. If the connected Landmark leaves play or flips face
    // down — or Atlantica itself does — the parked card is discarded to History.
    function usableAtlanticaSlots(pNum) {
        const board = document.getElementById(`player-${pNum}`);
        if (!board || !findLandmark(pNum, 'Atlantica')) return [];
        const lSlots = Array.from(board.querySelectorAll('.landmark-zone-main .card'));
        return Array.from(board.querySelectorAll('.atlantica-slot')).filter((s, i) => {
            const lm = lSlots[i];
            if (!lm || lm.classList.contains('slot-empty')) return false;
            try { return !JSON.parse(lm.dataset.cardData).deactivated; } catch (e) { return false; }
        });
    }

    // Reconcile the row with reality: discard parked cards whose Landmark is gone or
    // asleep, and show the row only while Atlantica itself is active.
    function syncAtlanticaZone(pNum) {
        const board = document.getElementById(`player-${pNum}`);
        if (!board) return;
        const zone = board.querySelector('.atlantica-zone');
        if (!zone) return;
        const lSlots = Array.from(board.querySelectorAll('.landmark-zone-main .card'));
        const hist = board.querySelector('.history-pile');
        const atlanticaActive = !!findLandmark(pNum, 'Atlantica');

        Array.from(zone.querySelectorAll('.atlantica-slot')).forEach((aSlot, i) => {
            if (aSlot.classList.contains('slot-empty')) return;
            let keep = atlanticaActive;
            if (keep) {
                const lm = lSlots[i];
                try {
                    keep = !!lm && !lm.classList.contains('slot-empty') && !JSON.parse(lm.dataset.cardData).deactivated;
                } catch (e) { keep = false; }
            }
            if (!keep) {
                let card;
                try { card = JSON.parse(aSlot.dataset.cardData); } catch (e) { card = null; }
                clearSlot(aSlot);
                if (card && hist) {
                    finishSingleCardPlacement(hist, card);
                    floatValue(hist, `${card.name} Discarded`, 'damage');
                }
            }
        });
        zone.classList.toggle('hidden', !atlanticaActive);
    }

    function finishSingleCardPlacement(targetSlot, card) {
        const isFuture = targetSlot.classList.contains('future-pile');
        const isHistory = targetSlot.classList.contains('history-pile');
        const isAbyss = targetSlot.classList.contains('card--abyss');
        const isStack = isFuture || isHistory || isAbyss;

        targetSlot.classList.remove('slot-empty');
        
        if (isStack) {
            let deck = [];
            if (targetSlot.dataset.cardData) {
                try {
                    deck = JSON.parse(targetSlot.dataset.cardData);
                    if (!Array.isArray(deck)) deck = [deck];
                } catch(e) { deck = []; }
            }
            // Lotus (Duality A2): a Creature discarded to History from its Lotus pad (defeat or
            // sacrifice) takes the Lotus with it — the after-attack path strips the marker first,
            // so only real removals carry the rider here. Both cards land in this History.
            if (isHistory && card && card.lotusPad) {
                const lotus = card.lotusPad;
                card = { ...card };
                delete card.lotusPad;
                deck.push(card);
                deck.push(lotus);
            } else {
                deck.push(card);
            }
            targetSlot.dataset.cardData = JSON.stringify(deck);
        } else {
            // Initialize creature-specific stats if placed in creature zone (only for actual
            // Creatures — a Lotus Artifact laid in the zone must not pick up combat stats).
            if (card.type === 'Creature' && targetSlot.parentNode && targetSlot.parentNode.classList.contains('creature-zone-main')) {
                if (card.summonedOnTurn === undefined) card.summonedOnTurn = totalTurns;
                if (card.damageTaken === undefined) card.damageTaken = 0;
                // parseInt || 1 would clobber a legitimate 0 base stat (e.g. Meridia); use isNaN instead.
                if (card.baseStrength === undefined) {
                    const p = parseInt(card.strength ?? card.health);
                    card.baseStrength = Number.isNaN(p) ? 1 : p;
                }
                if (card.baseResistance === undefined) {
                    const p = parseInt(card.resistance ?? card.health);
                    card.baseResistance = Number.isNaN(p) ? 1 : p;
                }
                // Aromeas (Duality C5): "Health Points become half of the Time Points of
                // your active Time Die upon entering the Creature Zone." Rounds UP, and the
                // value is FIXED at entry — it does not track the die as it changes later
                // (Simon's ruling). Both Strength and Resistance take the single HP value.
                if (card.name === 'Aromeas' && !card.aromeasSet) {
                    const ownerZone = targetSlot.closest('.player-zone');
                    const ownerNum = ownerZone ? parseInt(ownerZone.id.split('-')[1]) : currentPlayer;
                    const dieTP = playersState[ownerNum][activeDieType(ownerNum)];
                    const hp = Math.ceil(dieTP / 2);
                    card.baseStrength = hp;
                    card.baseResistance = hp;
                    card.aromeasSet = true;
                    floatValue(targetSlot, `${hp} HP (½ of ${dieTP})`, 'gain');
                }
            }
            targetSlot.dataset.cardData = JSON.stringify(card);
        }

        const art = cardArtUrl(card);
        const label = targetSlot.querySelector('.pile-label');
        if (label) label.style.display = 'none';

        if (isFuture) {
            const backImg = (card.type === 'Destiny' || card.location === 'D' || card.location === 'DA') ? 'destiny_back.png' : 'card_back.png';
            targetSlot.style.backgroundImage = `url('assets/${backImg}')`;
            targetSlot.style.backgroundColor = 'transparent';
            targetSlot.textContent = '';
        } else if (art) {
            targetSlot.style.backgroundImage = `url('${art}')`;
            targetSlot.style.backgroundColor = 'transparent';
            targetSlot.textContent = '';
        } else {
            targetSlot.style.backgroundImage = '';
            targetSlot.style.backgroundColor = 'rgba(255,255,255,0.1)';
            targetSlot.textContent = card.name;
        }

        if (isStack) updateStackIndicator(targetSlot);
        bindHoverToElement(targetSlot, card);
        updateCreatureVisuals(targetSlot);
        if (!isStack && card.deactivated) syncFaceDownVisual(targetSlot);

        if (!isStack && targetSlot.parentNode && targetSlot.parentNode.classList.contains('creature-zone-main')) {
            checkMeridiaZeroHp(targetSlot, card);
        }

        // A Landmark arriving (e.g. Atlantica itself) may reveal the extended-hand row.
        if (!isStack && targetSlot.parentNode && targetSlot.parentNode.classList.contains('landmark-zone-main')) {
            const bd = targetSlot.closest('.player-zone');
            if (bd) syncAtlanticaZone(parseInt(bd.id.split('-')[1]));
        }
    }

    function bindHoverToElement(el, cardData) {
        // Remove old listeners if any (simplified here)
        el.onmouseenter = () => {
            clearTimeout(hoverTimer);
            hoverTimer = setTimeout(() => {
                // Re-read live state — deactivation can change after binding.
                let card = cardData;
                if (el.dataset.cardData) {
                    try {
                        const live = JSON.parse(el.dataset.cardData);
                        if (!Array.isArray(live)) card = live;
                    } catch (e) {}
                }
                if (card && card.deactivated) {
                    // Face down: your own cards always peek; an opponent's only when it was
                    // deactivated after being shown (never for secret placements).
                    const ownerZone = el.closest('.player-zone');
                    const ownerNum = ownerZone ? parseInt(ownerZone.id.split('-')[1]) : 0;
                    if (card.faceDownSecret && ownerNum !== currentPlayer && !devMode) return;
                    cardModal.classList.add('asleep-preview');
                    showCardDetails(card);
                    return;
                }
                cardModal.classList.remove('asleep-preview');
                showCardDetails(card);
            }, 750);
        };
        el.onmouseleave = () => {
            clearTimeout(hoverTimer);
            cardModal.classList.add('hidden');
        };
    }

    document.addEventListener('mousemove', (e) => {
        if (heldGhost) {
            heldGhost.style.left = (e.clientX - 40) + 'px';
            heldGhost.style.top = (e.clientY - 55) + 'px';
        }
    });

    function initAllActiveBoards() {
        // Always reset all 4 just in case
        for (let i = 1; i <= 4; i++) {
            initPlayerBoard(i);
        }
    }

    // Make keyword accessible globally for inline onclick
    window.showKeyword = function(keywordKey) {
        renderKeywordsList(); // Ensure list is ready
        showKeywordDetail(keywordKey);
        keywordsListModal.classList.remove('hidden');
    };

    // --- State and Bazaar Logic ---
    let selectedSets = ['Unity'];
    let activeBazaar = {};

    function initBazaarInventory() {
        activeBazaar = {};
        cardData.forEach(card => {
            if (!activeBazaar[card.location]) activeBazaar[card.location] = [];
            
            let count = parseInt(card.rarity);
            if (card.type === 'Landmark') count = 3;
            if (card.type === 'Spark') count = 6;
            if (card.type === 'Steam') count = 10;
            if (isNaN(count)) count = 3; 

            // Create deep copies for each card in the pile
            for (let i = 0; i < count; i++) {
                activeBazaar[card.location].push({ ...card });
            }
        });
        shuffleBazaarPilesForFusion();
    }

    // Fusion Play: with more than one set active, each Bazaar position holds the
    // same-slot cards of every selected set shuffled together, so the top card
    // shown (and sold) is random — Unity or Duality alike. Single-set piles are
    // uniform per slot, so shuffling them is harmless.
    function shuffleBazaarPilesForFusion() {
        if (selectedSets.length < 2) return;
        Object.keys(activeBazaar).forEach(loc => {
            if (loc === 'D' || loc === 'DA' || loc === 'AB' || loc.startsWith('ST')) return;
            const pile = activeBazaar[loc];
            for (let i = pile.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pile[i], pile[j]] = [pile[j], pile[i]];
            }
        });
    }
    initBazaarInventory();

    function renderBazaar() {
        cards.forEach(card => {
            const loc = card.dataset.loc;
            if (!loc) return;

            const isAbyssLoc = loc === 'AB';
            let availableCards;
            if (isAbyssLoc) {
                // The Abyss isn't a Bazaar sale pile (no cardData entries target it) — it
                // accumulates real out-of-game cards in its own dataset.cardData instead.
                try { availableCards = JSON.parse(card.dataset.cardData || '[]'); } catch (e) { availableCards = []; }
            } else {
                const allInLoc = activeBazaar[loc] || [];
                availableCards = allInLoc.filter(c => selectedSets.includes(c.set));
            }

            // Clean up old stack visuals (Undoing previous stack thing)
            card.querySelectorAll('.card-stack-layer').forEach(e => e.remove());

            if (availableCards.length === 0) {
                card.classList.add('empty-pile');
                card.style.backgroundImage = '';
                card.style.backgroundColor = '';
                card.style.border = '';
            } else {
                card.classList.remove('empty-pile');

                const topCard = availableCards[availableCards.length - 1];
                const isDestiny = topCard.type === 'Destiny' || loc === 'D' || loc === 'DA';
                const isAbyss = isAbyssLoc;
                const isSteam = topCard.type === 'Steam';

                // Display count indicator only
                card.querySelectorAll('.rarity-indicator').forEach(e => e.remove());
                if (availableCards.length > 1 || (isAbyss && availableCards.length >= 1)) {
                    const indicator = document.createElement('div');
                    indicator.className = 'rarity-indicator tech-font';
                    const label = isAbyss ? ' IN ABYSS' : ' LEFT';
                    indicator.innerHTML = `<span class="count-value">${availableCards.length}</span><span class="count-label">${label}</span>`;
                    card.appendChild(indicator);
                }

                // With multiple sets active the piles are shuffled, so the top card
                // (and its art) can come from any selected set.
                const art = (!isDestiny && !isAbyss && !isSteam) ? cardArtUrl(topCard) : null;
                if (art) {
                    card.style.backgroundImage = `url('${art}')`;
                    card.style.backgroundColor = 'transparent';
                    card.style.border = 'none';
                } else {
                    card.style.backgroundImage = '';
                    card.style.backgroundColor = '';
                    card.style.border = '';
                }
            }
        });
    }

    function updateBazaarLighting() {
        if (!activeBazaar) return;

        const bazaarCards = document.querySelectorAll('.bazaar-area .card');
        
        if (!gameStarted) {
            bazaarCards.forEach(cardContainer => cardContainer.classList.remove('unavailable'));
            return;
        }

        const myBoard = document.getElementById(`player-${currentPlayer}`);
        if (!myBoard) return;

        let mySteams = { F: 0, G: 0, L: 0, A: 0 };
        // Atlantica-parked cards count as Hand for affordability too.
        const handSlots = Array.from(myBoard.querySelectorAll('.hand-slot, .atlantica-slot'));
        handSlots.forEach(s => {
            if (!s.classList.contains('slot-empty') && s.dataset.cardData) {
                try {
                    const data = JSON.parse(s.dataset.cardData);
                    if (data.type === 'Steam') {
                        if (data.name.includes('Fire')) mySteams.F++;
                        else if (data.name.includes('Gold')) mySteams.G++;
                        else if (data.name.includes('Laser')) mySteams.L++;
                        mySteams.A++; 
                    }
                } catch(e) {}
            }
        });

        let hasLethargos = false;
        let hasAetherlab = false;
        const landmarks = Array.from(myBoard.querySelectorAll('.landmark-zone-main .card'));
        landmarks.forEach(s => {
            if (!s.classList.contains('slot-empty') && s.dataset.cardData) {
                try {
                    const data = JSON.parse(s.dataset.cardData);
                    if (data.name === "Lethargo's Temple") hasLethargos = true;
                    if (data.name === "Aetherlab") hasAetherlab = true;
                } catch(e) {}
            }
        });

        // Pure Steam affordability (no Time Points involved).
        const steamAfford = (topCard) => {
            if (topCard.location === 'AB' || topCard.location === 'D' || topCard.location === 'DA') return true;
            if (topCard.name === 'FireSteam' || !topCard.cost || topCard.cost === '-') return true;

            let costString = topCard.cost;
            if (topCard.name === 'GoldSteam') costString = 'AAA';

            let costCost = { F: 0, G: 0, L: 0, A: 0 };
            for (let char of costString) {
                if (char === 'F') costCost.F++;
                else if (char === 'G') costCost.G++;
                else if (char === 'L') costCost.L++;
                else if (char === 'A') costCost.A++;
            }

            let availF = mySteams.F;
            let availG = mySteams.G;
            let availL = mySteams.L;

            if (availF < costCost.F) return false;
            availF -= costCost.F;
            if (availG < costCost.G) return false;
            availG -= costCost.G;
            if (availL < costCost.L) return false;
            availL -= costCost.L;

            let remainingSteams = availF + availG + availL;
            if (remainingSteams < costCost.A) return false;
            return true;
        };

        // Lethargo's Temple TP affordability — only when the Temple mode is armed.
        const templeArmed = hasLethargos && lethargoActive && !lethargoUsedThisPhase;
        const tpAfford = (topCard) => {
            if (!topCard.cost || topCard.cost === '-') return false;
            const plan = planLethargoPayment(topCard);
            return (playersState[currentPlayer].day + playersState[currentPlayer].night) >= plan.tp;
        };

        bazaarCards.forEach(cardContainer => {
            cardContainer.classList.remove('tp-affordable');
            if (cardContainer.classList.contains('empty-pile')) {
                cardContainer.classList.remove('unavailable');
                return;
            }

            const loc = cardContainer.dataset.loc;
            if (!loc) return;
            const availableCards = (activeBazaar[loc] || []).filter(c => selectedSets.includes(c.set));
            if (availableCards.length === 0) {
                cardContainer.classList.remove('unavailable');
                return;
            }

            const topCard = availableCards[availableCards.length - 1];
            const isSteam = topCard.type === 'Steam';

            let isAvailablePhase = false;
            if (currentPhase === 0) {
                if (isSteam) isAvailablePhase = true;
            } else if (currentPhase === 1) {
                if (!isSteam) isAvailablePhase = true;
            } else if (currentPhase === 2 || currentPhase === 3) {
                isAvailablePhase = false;
            }

            const steamOK = steamAfford(topCard);
            // Temple unlocks cards you can't afford in Steam but can cover with Time Points.
            const tpOK = templeArmed && !isSteam && !steamOK && tpAfford(topCard);
            const affordable = steamOK || tpOK;

            if (!isAvailablePhase || !affordable) {
                cardContainer.classList.add('unavailable');
            } else {
                cardContainer.classList.remove('unavailable');
                if (isAvailablePhase && tpOK) cardContainer.classList.add('tp-affordable');
            }
        });
    }

    window.updateBazaarLighting = updateBazaarLighting;

    renderBazaar();
    updateBazaarLighting();

    // --- Interaction Logic ---
    // --- Interaction Logic Rebinding ---
    cards.forEach(cardContainer => {
        const loc = cardContainer.dataset.loc;
        if (!loc) return;

        cardContainer.addEventListener('click', (e) => {
            // Deselect / Return logic
            if (heldCards.length > 0) {
                e.stopPropagation();
                // Aetherlab (Method B): dropping a held Steam on a same/next-tier drawer trades it up.
                if (tryAetherlabDrop(cardContainer)) return;
                // If it's Abyss, we place. Otherwise, we return to source.
                if (cardContainer.classList.contains('card--abyss') && heldCards[0].type === 'Spark') {
                    placeCard(cardContainer);
                } else {
                    cancelGrab();
                }
                return;
            }

            // Abyss: shared, view-only zone (removed from the game entirely). Any player can
            // click it to see the full list of what's out of game — no grabbing, no cost gate.
            if (loc === 'AB') {
                let abyssCards = [];
                try { abyssCards = JSON.parse(cardContainer.dataset.cardData || '[]'); } catch (e) { /* empty */ }
                if (abyssCards.length === 0) return;

                const locationTitle = document.getElementById('location-title');
                const locationCards = document.getElementById('location-cards');
                locationTitle.textContent = 'Abyss — Out of Game';
                locationCards.innerHTML = '';
                locationCardPreview.classList.add('hidden');

                abyssCards.forEach(c => {
                    const cardDiv = document.createElement('div');
                    cardDiv.className = 'location-card-item glass-panel';
                    cardDiv.innerHTML = `
                        <div class="loc-card-header">
                            <span class="loc-card-num">${c.number || ''}</span>
                            <span class="loc-card-name">${c.name}</span>
                        </div>
                        <div class="loc-card-cost">${c.cost || '-'}</div>
                    `;
                    bindHoverToElement(cardDiv, c);
                    locationCards.appendChild(cardDiv);
                });
                locationModal.classList.remove('hidden');
                return;
            }

            if (!devMode && cardContainer.classList.contains('unavailable')) return;

            const allInLoc = activeBazaar[loc] || [];
            const availableCards = allInLoc.filter(c => selectedSets.includes(c.set));
            if (availableCards.length === 0) return;

            // Sparks buy-and-play in one click: pay cost, resolve the effect immediately,
            // then send the card straight to the Abyss. No grab/drop step — a Spark never
            // rests in Hand from a Bazaar buy (that's what made the old flow confusing).
            if (availableCards[0].type === 'Spark') {
                if (!devMode && !gameStarted) return;
                const card = { ...availableCards[availableCards.length - 1] };
                if (!devMode) autoPayCost(card);
                const idx = allInLoc.findIndex(c => c.name === card.name);
                if (idx !== -1) allInLoc.splice(idx, 1);
                renderBazaar();
                if (window.updateBazaarLighting) window.updateBazaarLighting();
                const abyssEl = document.querySelector('.card--abyss');
                finishSingleCardPlacement(abyssEl, card);
                resolveSparkEffect(currentPlayer, card);
                return;
            }

            // If all cards in the pile are the same name, just grab the top one directly
            const allSame = availableCards.every(c => c.name === availableCards[0].name);

            if (allSame) {
                if (heldCards.length === 0) {
                    if (!devMode && !gameStarted && cardContainer.closest('.bazaar-area')) return; // Block direct grab before start
                    grabCard(availableCards[availableCards.length - 1], cardContainer);
                }
                return;
            }

            // Location stack modal
            const locationTitle = document.getElementById('location-title');
            const locationCards = document.getElementById('location-cards');
            locationTitle.textContent = cardContainer.dataset.type + " Stack";
            locationCards.innerHTML = '';
            locationCardPreview.classList.add('hidden');

            availableCards.forEach(c => {
                const cardDiv = document.createElement('div');
                cardDiv.className = 'location-card-item glass-panel';
                cardDiv.innerHTML = `
                    <div class="loc-card-header">
                        <span class="loc-card-num">${c.number || ''}</span>
                        <span class="loc-card-name">${c.name}</span>
                    </div>
                    <div class="loc-card-cost">${c.cost || '-'}</div>
                `;
                
                cardDiv.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    if (!devMode && !gameStarted && cardContainer.closest('.bazaar-area')) return; // Block grab from modal before start
                    if (heldCards.length > 0) return; // Prevent double-grab
                    grabCard(c, cardContainer); // Stack returns to its Bazaar container
                    locationModal.classList.add('hidden');
                });
                
                // Hover preview for items in list
                bindHoverToElement(cardDiv, c);
                
                locationCards.appendChild(cardDiv);
            });
            locationModal.classList.remove('hidden');
        });

        // Bazaar card hover logic
        cardContainer.addEventListener('mouseenter', () => {
            const availableCards = cardData.filter(c => selectedSets.includes(c.set) && c.location === loc);
            if (availableCards.length > 0) {
                hoverTimer = setTimeout(() => {
                    showCardDetails(availableCards[availableCards.length-1], true);
                }, 750);
            }
            // Lethargo's Temple armed: show this card's Time-Point cost immediately,
            // and mirror it (name + full breakdown) into the context window.
            const live = (activeBazaar[loc] || []).filter(c => selectedSets.includes(c.set));
            if (live.length > 0) {
                showTpCostHint(cardContainer, live[live.length - 1]);
                if (lethargoActive) updateLethargoViewed(live[live.length - 1]);
            }
        });
        cardContainer.addEventListener('mouseleave', () => {
            clearTimeout(hoverTimer);
            cardModal.classList.add('hidden');
            hideTpCostHint();
            if (lethargoActive) updateLethargoViewed(null);
        });
    });

    // --- Modal Controls ---
    btnOptions.addEventListener('click', () => {
        optionsModal.classList.remove('hidden');
    });

    closeOptionsModalBtn.addEventListener('click', () => {
        optionsModal.classList.add('hidden');
    });

    closeCardModalBtn.addEventListener('click', () => {
        cardModal.classList.add('hidden');
    });

    closeKeywordModalBtn.addEventListener('click', () => {
        keywordModal.classList.add('hidden');
    });
    
    closeLocationModalBtn.addEventListener('click', () => {
        locationModal.classList.add('hidden');
    });

    btnRules.addEventListener('click', () => {
        rulesModal.classList.remove('hidden');
        currentPage = 0;
        updateBook();
    });

    closeRulesModalBtn.addEventListener('click', () => {
        rulesModal.classList.add('hidden');
    });

    // --- 3D Book Logic ---
    let currentPage = 0;
    const pages = document.querySelectorAll('.book-page');

    function updateBook() {
        pages.forEach((page, index) => {
            if (index < currentPage) {
                page.classList.add('flipped');
                page.style.zIndex = index;
            } else {
                page.classList.remove('flipped');
                page.style.zIndex = pages.length - index;
            }
        });
    }

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 0) {
            currentPage--;
            updateBook();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        if (currentPage < pages.length - 1) {
            currentPage++;
            updateBook();
        }
    });

    updateBook();

    const playersState = {
        1: { day: 12, night: 12, activeDie: 'day' },
        2: { day: 12, night: 12, activeDie: 'day' },
        3: { day: 12, night: 12, activeDie: 'day' },
        4: { day: 12, night: 12, activeDie: 'day' }
    };

    // Which die a player's Time Point changes hit first. Day by default; Time Bender
    // switches it. A die at 0 is permanently lost and can't be active — fall back to
    // the other one so damage/gains always land on a live die.
    function activeDieType(pNum) {
        const st = playersState[pNum];
        if (!st) return 'day';
        const pref = st.activeDie === 'night' ? 'night' : 'day';
        const other = pref === 'night' ? 'day' : 'night';
        return st[pref] > 0 ? pref : other;
    }
    function activeDieSel(pNum) {
        return activeDieType(pNum) === 'night' ? '.night-die-group' : '.day-die-group';
    }

    // Time Bender: the switched die gets a marker ring so both players can see whose
    // clock is running. Day-active is the default and shows no marker.
    function updateActiveDieGlow(pNum) {
        const board = document.getElementById(`player-${pNum}`);
        if (!board) return;
        const night = board.querySelector('.night-die-group');
        if (night) night.classList.toggle('active-die-marker', playersState[pNum].activeDie === 'night');
    }

    function updatePlayerDieUI(pNum, type) {
        const playerEl = document.getElementById(`player-${pNum}`);
        if (!playerEl) return;

        const val = playersState[pNum][type];
        const groupEl = playerEl.querySelector(type === 'day' ? '.day-die-group' : '.night-die-group');
        const counterEl = groupEl.querySelector('.circle-counter');

        if (val <= 0) {
            groupEl.classList.add('vanished');
        } else {
            groupEl.classList.remove('vanished');
            counterEl.textContent = val;
            
            // Pulse effect
            counterEl.classList.add('pulse-update');
            setTimeout(() => counterEl.classList.remove('pulse-update'), 600);
        }
        
        checkGameOver();
    }

    function checkGameOver() {
        if (!gameOverOverlay) return;
        
        let alivePlayers = [];
        for (let i = 1; i <= activePlayerCount; i++) {
            const p = playersState[i];
            if ((p.day + p.night) > 0) {
                alivePlayers.push(i);
            }
        }

        if (alivePlayers.length === 1) {
            gameWon = true;
            const winnerNum = alivePlayers[0];
            if (winnerTitle) {
                winnerTitle.textContent = vsComputer
                    ? (winnerNum === AI_PLAYER ? 'COMPUTER WON' : 'YOU WON!')
                    : `PLAYER ${winnerNum} WON!`;
            }
            gameOverOverlay.classList.remove('hidden');
            
            // Add "Switch View" button for post-game inspection
            if (!document.getElementById('btn-switch-view')) {
                const switchBtn = document.createElement('button');
                switchBtn.id = 'btn-switch-view';
                switchBtn.className = 'menu-btn combat-btn';
                switchBtn.textContent = 'SWITCH VIEW';
                switchBtn.style.marginTop = '15px';
                switchBtn.onclick = () => {
                    const nextP = (currentPlayer % activePlayerCount) + 1;
                    currentPlayer = nextP;
                    
                    document.querySelectorAll('.player-zone').forEach(z => z.classList.remove('active-player'));
                    const activeBoard = document.getElementById(`player-${currentPlayer}`);
                    if (activeBoard) {
                        activeBoard.classList.add('active-player');
                        const label = document.getElementById('active-player-label');
                        if (label) label.textContent = `PLAYER ${currentPlayer} (END STATE)`;
                        
                        const gameField = document.getElementById('game-field');
                        if (gameField) {
                            gameField.className = `players-${activePlayerCount} turn-p${currentPlayer}`;
                        }
                    }
                };
                gameOverOverlay.querySelector('.overlay-content').appendChild(switchBtn);
            }
        } else if (alivePlayers.length === 0) {
            gameWon = true;
            if (winnerTitle) winnerTitle.textContent = `DRAW!`;
            gameOverOverlay.classList.remove('hidden');
        }
    }

    // --- Shared landmark trigger feedback ---
    // Return the landmark card element (by name) on a player's board, or null.
    function findLandmark(pNum, cardName) {
        const board = document.getElementById(`player-${pNum}`);
        if (!board) return null;
        const slots = board.querySelectorAll('.landmark-zone-main .card:not(.slot-empty)');
        for (const s of slots) {
            try {
                // A deactivated (face-down) Landmark grants no effects — treat it as absent.
                const d = JSON.parse(s.dataset.cardData);
                if (d.name === cardName && !d.deactivated) return s;
            } catch (e) { /* skip */ }
        }
        return null;
    }

    // Briefly glow a landmark card (by name, on a player's board) to signal it fired.
    function pulseLandmark(pNum, cardName) {
        const s = findLandmark(pNum, cardName);
        if (!s) return null;
        s.classList.remove('landmark-triggered');
        void s.offsetWidth; // restart animation
        s.classList.add('landmark-triggered');
        setTimeout(() => s.classList.remove('landmark-triggered'), 900);
        return s;
    }

    // Float a short value (e.g. "+1 TP") centered over a target element, then fade upward.
    function floatValue(targetEl, text, variant = 'gain') {
        if (!targetEl) return;
        const rect = targetEl.getBoundingClientRect();
        const el = document.createElement('div');
        el.className = `float-value float-value--${variant}`;
        el.textContent = text;
        el.style.left = `${rect.left + rect.width / 2}px`;
        el.style.top = `${rect.top + rect.height / 2}px`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1300);
    }

    // --- Clone Factory: discard a GoldSteam during the Creature Phase to attack twice ---
    // Click the landmark before attacking. It discards a GoldSteam from hand, then arms the
    // next Creature's attack to strike twice in a row (target re-selectable on the 2nd strike).
    // The landmark glows until the second strike resolves. See finishAttacker /
    // maybeCloneSecondStrike for how the attacker is kept in its zone between the two strikes.
    function activateCloneFactory() {
        if (cloneFactoryArmed) {
            alert('Clone Factory is already primed — attack with a Creature to use both strikes.');
            return;
        }
        const board = document.getElementById(`player-${currentPlayer}`);
        if (!board) return;

        // Need a GoldSteam in hand to spend.
        const goldSlot = Array.from(board.querySelectorAll('.hand-slot:not(.slot-empty), .atlantica-slot:not(.slot-empty)')).find(s => {
            try { return JSON.parse(s.dataset.cardData).name === 'GoldSteam'; } catch (e) { return false; }
        });
        if (!goldSlot) {
            alert('Clone Factory needs a GoldSteam in hand to activate.');
            return;
        }

        // Discard the GoldSteam to History.
        const data = JSON.parse(goldSlot.dataset.cardData);
        const historySlot = board.querySelector('.history-pile');
        animateCardToHistory(goldSlot, historySlot, data);
        clearSlot(goldSlot);
        updateHandLayout(currentPlayer);

        cloneFactoryArmed = true;
        cloneSecondStrikePending = false;
        cloneAttackerSlot = null;
        armCloneFactory();
        pulseLandmark(currentPlayer, 'Clone Factory');
    }

    function armCloneFactory() {
        const el = findLandmark(currentPlayer, 'Clone Factory');
        if (!el) return;
        el.classList.add('clone-armed');
        if (!el.querySelector('.clone-badge')) {
            const badge = document.createElement('div');
            badge.className = 'clone-badge tech-font';
            badge.textContent = '⚔ Attack ×2';
            el.appendChild(badge);
        }
    }

    function disarmCloneFactory() {
        cloneFactoryArmed = false;
        cloneSecondStrikePending = false;
        cloneAttackerSlot = null;
        document.querySelectorAll('.landmark-zone-main .clone-armed').forEach(el => {
            el.classList.remove('clone-armed');
            const badge = el.querySelector('.clone-badge');
            if (badge) badge.remove();
        });
    }

    // Move a spent attacker to History after its strike — unless Clone Factory is primed for a
    // first strike, in which case the creature stays in its zone to strike a second time.
    function finishAttacker(attackerSlot, attacker, attackerHistory, defeated = false) {
        // Tele Control (Duality S3): a commandeered Creature that SURVIVES its strike is not
        // discarded — it stays in its owner's zone (the card overrides the normal "attacked → to
        // History" spend). Only a genuine defeat (mutual destruction, defeated=true) still sends
        // it to History, since it actually hit 0 HP.
        if (attacker.teleControlled && !defeated) {
            if (cloneFactoryArmed) disarmCloneFactory();
            return;
        }
        // Looper: stays in his zone until the rolled strikes are used up; History after the last.
        if (attacker.name === 'Looper' && looperStrikesRemaining > 1) {
            looperStrikesRemaining--;
            looperFirstStrikeResolved = true;
            looperPendingSlot = attackerSlot;
            return;
        }
        if (attacker.name === 'Looper') resetLooper();
        if (cloneFactoryArmed && !cloneSecondStrikePending) {
            cloneSecondStrikePending = true;
            cloneAttackerSlot = attackerSlot;
            return; // keep the creature in place for its second attack
        }
        // Masiota may dodge the normal after-attack discard by deactivating instead.
        if (maybeMasiotaRescue(attackerSlot, attacker)) {
            if (cloneFactoryArmed) disarmCloneFactory();
            return;
        }
        cellShieldDefender = null; // attack fully resolved — clear any unused Cell Shield arming
        // Lotus (Duality A2): a Creature that merely ATTACKED and is now spent (not defeated in
        // combat) leaves its Lotus pad behind, reusable next turn — detach the Lotus, re-seat it
        // as an empty pad, and strip the marker so the History chokepoint doesn't take it too.
        // A mutually-destroyed attacker (defeated) keeps the marker so the Lotus rides to History.
        if (attacker.lotusPad && !defeated) {
            const lotus = attacker.lotusPad;
            attacker = { ...attacker };
            delete attacker.lotusPad;
            clearSlot(attackerSlot);
            finishSingleCardPlacement(attackerSlot, lotus);
            refreshBoardAfterDeactivation(attackerSlot);
            finishSingleCardPlacement(attackerHistory, attacker);
            if (cloneFactoryArmed) disarmCloneFactory();
            return;
        }
        clearSlot(attackerSlot);
        finishSingleCardPlacement(attackerHistory, attacker);
        if (cloneFactoryArmed) disarmCloneFactory();

        // Sea Lord (Duality C8): after he attacks and is discarded, you may fold your
        // History + Future into a fresh, shuffled Future Pile. He's already in History by
        // now, so he cycles back into the deck too. The Computer declines the option (V1).
        if (attacker.name === 'Sea Lord' && !aiTurnInProgress) {
            const board = attackerHistory.closest('.player-zone');
            if (board) maybeSeaLordReshuffle(parseInt(board.id.split('-')[1]));
        }
    }

    // Sea Lord's optional deck refresh: combine this player's History + Future into one
    // shuffled Future Pile (History emptied). Reuses the two reshuffle rules the End-Phase
    // fold already established — Meridia is exiled to the Abyss rather than shuffled back,
    // and forming a new Future Pile from History triggers Gravitas's refill.
    function maybeSeaLordReshuffle(pNum) {
        const board = document.getElementById(`player-${pNum}`);
        if (!board) return;
        const futurePile = board.querySelector('.future-pile');
        const historyPile = board.querySelector('.history-pile');
        if (!futurePile || !historyPile) return;

        const readData = (el) => { try { return JSON.parse(el.dataset.cardData || '[]'); } catch (e) { return []; } };
        const history = readData(historyPile);
        const future = readData(futurePile);
        if (!history.length && !future.length) return; // nothing to shuffle

        if (!confirm('Sea Lord: shuffle your History Pile and Future Pile into a new Future Pile?')) return;

        const combined = history.concat(future);
        const meridiaCards = combined.filter(c => c.name === 'Meridia');
        const shuffleable = combined.filter(c => c.name !== 'Meridia');
        if (meridiaCards.length) {
            activeBazaar['AB'] = (activeBazaar['AB'] || []).concat(meridiaCards);
            renderBazaar();
        }

        futurePile.dataset.cardData = JSON.stringify(shuffleArray([...shuffleable]));
        historyPile.dataset.cardData = JSON.stringify([]);
        updateStackIndicator(historyPile);
        updateStackIndicator(futurePile);
        floatValue(futurePile, 'Reshuffled', 'gain');

        resolveGravitasRefill(pNum);
    }

    // After an attack's result overlay closes, if Clone Factory kept the attacker for a second
    // strike, re-open the attack flow for that same creature (target re-selectable).
    function maybeCloneSecondStrike() {
        maybeLooperNextStrike(); // Looper's follow-up strikes ride the same close-of-overlay hook
        if (!cloneSecondStrikePending) return;
        const slot = cloneAttackerSlot;
        if (!slot || slot.classList.contains('slot-empty')) { disarmCloneFactory(); return; }
        let data;
        try { data = JSON.parse(slot.dataset.cardData); } catch (e) { disarmCloneFactory(); return; }
        pulseLandmark(currentPlayer, 'Clone Factory');
        // Brief delay so the previous overlay fully hides before the second strike opens.
        setTimeout(() => triggerAttack(data, slot), 150);
    }

    // --- Landmark effects triggered by discarding a card into your own History ---
    // These share one gesture (drop a card into your own History, normally illegal) and
    // are disambiguated by phase + Steam type. When exactly one landmark is eligible it
    // fires automatically; when two are eligible (Wasteland + Planetarium on a FireSteam
    // in Construction) the player is asked which to use.

    // --- Time Bender (Duality L2): once per Construction Phase, switch your active Time Die ---
    // Click the landmark during your Construction Phase. The switch is persistent: damage and
    // TP gains hit the chosen die first from then on, until it's switched again (or the die is
    // lost). The Night die wears a marker ring while it's the active one.
    let timeBenderUsedThisPhase = false;
    function activateTimeBender() {
        if (timeBenderUsedThisPhase) {
            alert('Time Bender has already switched your active Time Die this Construction Phase.');
            return;
        }
        const st = playersState[currentPlayer];
        const next = activeDieType(currentPlayer) === 'day' ? 'night' : 'day';
        if (st[next] <= 0) {
            alert(`Your ${next === 'night' ? 'Night' : 'Day'} Die is already lost — there is nothing to switch to.`);
            return;
        }
        st.activeDie = next;
        timeBenderUsedThisPhase = true;
        pulseLandmark(currentPlayer, 'Time Bender');
        updateActiveDieGlow(currentPlayer);
        const board = document.getElementById(`player-${currentPlayer}`);
        if (board) floatValue(board.querySelector(activeDieSel(currentPlayer)), next === 'night' ? 'Night Active' : 'Day Active', 'gain');
    }

    // --- Repo Station (Duality L4): 1 TP per defeated opponent Creature, or sacrifice your own ---
    // Auto half: whenever your attack defeats an opponent's Creature (blocker destroyed,
    // including mutual destruction; a repelled attack gives nothing), gain 1 Time Point.
    // Active half: click the landmark in your Construction or Creature Phase to sacrifice
    // one of your own Creatures from the zone for 1 Time Point.
    function applyRepoStationGain(attackerSlot) {
        const board = attackerSlot.closest('.player-zone');
        if (!board) return;
        const pNum = parseInt(board.id.split('-')[1]);
        if (!findLandmark(pNum, 'Repo Station')) return;
        gainTimePoints(pNum, 1);
        pulseLandmark(pNum, 'Repo Station');
        floatValue(board.querySelector(activeDieSel(pNum)), '+1 TP', 'gain');
    }

    function activateRepoStation() {
        const board = document.getElementById(`player-${currentPlayer}`);
        if (!board) return;
        const creatures = Array.from(board.querySelectorAll('.creature-zone-main .card:not(.slot-empty)')).filter(s => {
            try { return JSON.parse(s.dataset.cardData).type === 'Creature'; } catch (e) { return false; }
        });
        if (!creatures.length) {
            alert('Repo Station: you have no Creature in your Creature Zone to sacrifice.');
            return;
        }
        if (creatures.length === 1) { repoSacrifice(creatures[0]); return; }
        // Several candidates — pulse them red (same picker pattern as Threat/Wasteland)
        // and let the player click which one to sacrifice.
        const cleanup = () => creatures.forEach(s => {
            s.classList.remove('threat-target');
            if (s._repoHandler) s.removeEventListener('click', s._repoHandler, true);
            delete s._repoHandler;
        });
        creatures.forEach(s => {
            s.classList.add('threat-target');
            const handler = (e) => {
                e.stopPropagation();
                e.preventDefault();
                cleanup();
                repoSacrifice(s);
            };
            s._repoHandler = handler;
            s.addEventListener('click', handler, true); // capture: preempt the normal creature click
        });
    }

    function repoSacrifice(slot) {
        const board = document.getElementById(`player-${currentPlayer}`);
        let card;
        try { card = JSON.parse(slot.dataset.cardData); } catch (e) { return; }
        // Masiota can dodge the sacrifice by deactivating — but then it wasn't a
        // sacrifice, so Repo Station pays no Time Point either.
        if (maybeMasiotaRescue(slot, card)) return;
        floatValue(slot, 'Sacrificed', 'damage');
        clearSlot(slot);
        finishSingleCardPlacement(board.querySelector('.history-pile'), card);
        pulseLandmark(currentPlayer, 'Repo Station');
        gainTimePoints(currentPlayer, 1);
        floatValue(board.querySelector(activeDieSel(currentPlayer)), '+1 TP', 'gain');
    }

    // --- Hand of Rhone (Duality L5): charge Force each Construction Phase, then release it ---
    // Charging is automatic: +1 Force (the counting Futory Die, capped at 6) when the owner
    // enters their Construction Phase. Click the landmark during your Construction Phase to
    // open its context window and release the Force: it travels around the table — in
    // 2-player V1 it alternates opponent, you, opponent… for the charged distance, 1 damage
    // per pass (either table direction reaches the opponent first, so no direction choice is
    // needed until 3-4 players). At a full charge of 6 the owner HEALS on their own passes
    // instead of taking damage (opponent -3 / you +3). Releasing removes the die (charge 0).
    const rhoneCharge = { 1: 0, 2: 0, 3: 0, 4: 0 };
    let rhoneChargedThisPhase = false;
    let rhoneContextOpen = false;
    let rhoneReleasing = false;

    function updateRhoneBadge(pNum) {
        const el = findLandmark(pNum, 'Hand of Rhone');
        if (!el) { rhoneCharge[pNum] = 0; return; } // landmark gone -> its die goes with it
        let badge = el.querySelector('.rhone-badge');
        if (rhoneCharge[pNum] <= 0) { if (badge) badge.remove(); return; }
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'rhone-badge tech-font';
            el.appendChild(badge);
        }
        badge.textContent = `⚡ ${rhoneCharge[pNum]} Force`;
        badge.classList.toggle('full', rhoneCharge[pNum] >= 6);
    }

    function chargeHandOfRhone() {
        if (rhoneChargedThisPhase) return;
        const el = findLandmark(currentPlayer, 'Hand of Rhone');
        if (!el) return;
        rhoneChargedThisPhase = true;
        if (rhoneCharge[currentPlayer] >= 6) return; // the counting die caps at 6
        rhoneCharge[currentPlayer]++;
        pulseLandmark(currentPlayer, 'Hand of Rhone');
        floatValue(el, '+1 Force', 'gain');
        updateRhoneBadge(currentPlayer);
    }

    // The Force walks the table seat by seat from its owner. dir +1 = towards the next
    // player, -1 = towards the previous one. With 2 players both directions produce the
    // same opponent → you alternation, so the direction choice only surfaces at 3+.
    let rhoneDirection = 1;
    function rhoneSeat(owner, dir, step) {
        return ((owner - 1 + dir * step) % activePlayerCount + activePlayerCount) % activePlayerCount + 1;
    }
    // How a released charge splits across the seats it passes: { order, hits }.
    function rhonePasses(charge, owner, dir) {
        const hits = {};
        const order = [];
        for (let i = 1; i <= charge; i++) {
            const p = rhoneSeat(owner, dir, i);
            if (!(p in hits)) order.push(p);
            hits[p] = (hits[p] || 0) + 1;
        }
        return { order, hits };
    }
    function rhonePreviewText(charge, owner, dir, full) {
        const { order, hits } = rhonePasses(charge, owner, dir);
        return order.map(p => {
            const who = p === owner ? 'You' : (activePlayerCount === 2 ? 'Opponent' : `P${p}`);
            const sign = (p === owner && full) ? '+' : '−';
            return `${who} ${sign}${hits[p]} TP`;
        }).join(' · ');
    }

    function toggleRhoneContext() {
        if (rhoneReleasing) return;
        if (rhoneContextOpen) { closeRhoneContext(); return; }
        const win = document.getElementById('landmark-context');
        const title = document.getElementById('landmark-context-title');
        const body = document.getElementById('landmark-context-body');
        if (!win || !title || !body) return;
        const charge = rhoneCharge[currentPlayer];
        const full = charge >= 6;
        title.textContent = 'Hand of Rhone';
        body.innerHTML = '';

        const row = document.createElement('div');
        row.className = 'landmark-context-row';
        const label = document.createElement('div');
        label.className = 'landmark-context-label';
        label.textContent = `Charged: ${charge} Force${full ? ' (full)' : ''}`;
        row.appendChild(label);
        const btn = document.createElement('button');
        btn.className = 'landmark-toggle-btn';
        btn.textContent = 'Release Force';
        if (charge <= 0) btn.disabled = true;
        btn.onclick = () => releaseHandOfRhone();
        row.appendChild(btn);
        body.appendChild(row);

        const preview = document.createElement('div');
        preview.className = 'landmark-context-viewed';
        const refreshPreview = () => {
            preview.innerHTML = charge <= 0
                ? '<span class="lc-viewed-hint">No Force charged yet — it charges each Construction Phase</span>'
                : `<div class="lc-viewed-name">${rhonePreviewText(charge, currentPlayer, rhoneDirection, full)}</div>` +
                  `<div class="lc-viewed-cost">${full ? 'Full charge: you heal instead of taking damage' : 'The Force passes you too — charge to 6 to heal instead'}</div>`;
        };

        // 3+ players: the owner chooses which way around the table the Force travels.
        if (activePlayerCount > 2) {
            const dirRow = document.createElement('div');
            dirRow.className = 'landmark-context-row';
            const dirLabel = document.createElement('div');
            dirLabel.className = 'landmark-context-label';
            dirLabel.textContent = 'Direction';
            const dirBtn = document.createElement('button');
            dirBtn.className = 'landmark-toggle-btn';
            const syncDir = () => {
                dirBtn.textContent = rhoneDirection === 1
                    ? `→ Towards P${rhoneSeat(currentPlayer, 1, 1)}`
                    : `← Towards P${rhoneSeat(currentPlayer, -1, 1)}`;
            };
            syncDir();
            dirBtn.onclick = () => { rhoneDirection = -rhoneDirection; syncDir(); refreshPreview(); };
            dirRow.appendChild(dirLabel);
            dirRow.appendChild(dirBtn);
            body.appendChild(dirRow);
        }

        refreshPreview();
        body.appendChild(preview);

        rhoneContextOpen = true;
        win.classList.remove('hidden');
        pulseLandmark(currentPlayer, 'Hand of Rhone');
    }

    function closeRhoneContext() {
        rhoneContextOpen = false;
        closeLandmarkContext();
    }

    async function releaseHandOfRhone() {
        const charge = rhoneCharge[currentPlayer];
        if (charge <= 0 || rhoneReleasing) return;
        rhoneReleasing = true;
        const full = charge >= 6;
        const owner = currentPlayer;
        const dir = activePlayerCount > 2 ? rhoneDirection : 1;
        rhoneCharge[owner] = 0; // the counting Futory Die is removed
        updateRhoneBadge(owner);
        closeRhoneContext();
        pulseLandmark(owner, 'Hand of Rhone');

        for (let i = 1; i <= charge; i++) {
            const target = rhoneSeat(owner, dir, i);
            const board = document.getElementById(`player-${target}`);
            if (target === owner && full) {
                gainTimePoints(owner, 1);
                if (board) floatValue(board.querySelector(activeDieSel(owner)), '+1 TP', 'gain');
            } else {
                const dieSel = activeDieSel(target); // read before the hit so the float lands right
                resolveDamageDirectly(1, target);
                if (board) floatValue(board.querySelector(dieSel), '-1 TP', 'damage');
            }
            await new Promise(r => setTimeout(r, 550));
        }
        rhoneReleasing = false;
    }

    // Laser Catalyst: LaserSteam, End Phase -> 1 unpreventable damage to the opponent.
    function catalystEligible(card) {
        return !devMode && card && card.name === 'LaserSteam'
            && currentPhase === 3 && !!findLandmark(currentPlayer, 'Laser Catalyst');
    }
    function fireCatalyst() {
        const opponent = (currentPlayer % activePlayerCount) + 1;
        // Determine which die takes the hit BEFORE applying damage, so the float lands
        // on the correct die even when this point empties the Day die.
        const dieSel = activeDieSel(opponent);
        resolveDamageDirectly(1, opponent);
        pulseLandmark(currentPlayer, 'Laser Catalyst');
        const oppBoard = document.getElementById(`player-${opponent}`);
        if (oppBoard) floatValue(oppBoard.querySelector(dieSel), '-1 TP', 'damage');
    }

    // Dragura's Wasteland: FireSteam, Construction Phase -> fully heal a damaged Creature.
    function damagedCreatures() {
        const board = document.getElementById(`player-${currentPlayer}`);
        if (!board) return [];
        return [...board.querySelectorAll('.creature-zone-main .card:not(.slot-empty)')].filter(s => {
            try { return (JSON.parse(s.dataset.cardData).damageTaken || 0) > 0; } catch (e) { return false; }
        });
    }
    function wastelandEligible(card) {
        return !devMode && card && card.name === 'FireSteam'
            && currentPhase === 1 && !!findLandmark(currentPlayer, "Dragura's Wasteland")
            && damagedCreatures().length > 0;
    }
    function fireWasteland() {
        const damaged = damagedCreatures();
        if (damaged.length === 0) return;
        if (damaged.length === 1) healCreature(damaged[0]);
        else promptHealTarget(damaged);
    }

    // Planetarium: any card, Construction Phase, once per turn -> stage discards, then
    // click the landmark to draw an equal number from Future (see staging helpers below).
    function planetariumEligible(card) {
        return !devMode && card && currentPhase === 1
            && !planetariumUsedThisTurn && !!findLandmark(currentPlayer, 'Planetarium');
    }

    // Which landmarks could consume this card right now (given phase + type + state).
    function getDiscardLandmarkOptions(card) {
        if (devMode || !card) return [];
        const options = [];
        if (catalystEligible(card))    options.push({ name: 'Laser Catalyst', fire: fireCatalyst });
        if (wastelandEligible(card))   options.push({ name: "Dragura's Wasteland", fire: fireWasteland });
        if (planetariumEligible(card)) options.push({ name: 'Planetarium', fire: stagePlanetarium });
        return options;
    }

    // Fire a specific landmark's discard effect by name (used by direct selection).
    function fireLandmarkByName(name, card) {
        const opt = getDiscardLandmarkOptions(card).find(o => o.name === name);
        if (opt) opt.fire();
    }

    // Coordinator: called after a card lands in the active player's History pile.
    // (Path 1 — drop into History and let the game disambiguate.)
    function resolveHistoryDiscard(card) {
        const options = getDiscardLandmarkOptions(card);
        if (options.length === 0) return;
        if (options.length === 1) { options[0].fire(); return; }
        promptLandmarkChoice(options); // genuine 2+ conflict -> ask
    }

    // Small chooser shown only for the real conflict case (2+ eligible landmarks).
    function promptLandmarkChoice(options) {
        const overlay = document.createElement('div');
        overlay.className = 'overlay landmark-choice-overlay';
        const panel = document.createElement('div');
        panel.className = 'glass-panel landmark-choice-panel';
        const title = document.createElement('div');
        title.className = 'fantasy-font glowing-text landmark-choice-title';
        title.textContent = 'Which Landmark?';
        panel.appendChild(title);
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'menu-btn tech-font';
            btn.textContent = opt.name;
            btn.onclick = () => { overlay.remove(); opt.fire(); };
            panel.appendChild(btn);
        });
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    }

    // --- Spark effects ---
    // Sparks are one-shot: the effect fires the instant the card lands in the Abyss (see the
    // resolveSparkEffect() call in placeCard) — that drop IS the "play" gesture in this manual-
    // enforcement engine. Add new Sparks by registering their name below.
    const sparkEffects = {
        'Reversal': (pNum) => resolveReversal(pNum),
        'Faith': (pNum) => resolveFaith(pNum),
        'Threat': (pNum) => resolveThreat(pNum),
        'Confiscation': (pNum) => resolveConfiscation(pNum),
        'Alchemy': (pNum) => resolveAlchemy(pNum),
        'Tame Beast': (pNum) => resolveTameBeast(pNum),
        'Tele Control': (pNum) => resolveTeleControl(pNum),
        'Burden of Wealth': (pNum) => resolveBurden(pNum),
    };

    function resolveSparkEffect(pNum, card) {
        const fn = sparkEffects[card.name];
        if (fn) fn(pNum, card);
    }

    // Faith: Draw a Card. Gain 3 Time Points.
    async function resolveFaith(pNum) {
        await drawCards(pNum, 1);
        gainTimePoints(pNum, 3);
        const board = document.getElementById(`player-${pNum}`);
        if (board) {
            const dieSel = activeDieSel(pNum);
            floatValue(board.querySelector(dieSel), '+3 TP', 'gain');
        }
    }

    // Reversal: Take a Card from your History Pile and place it in your Hand.
    // If History is empty the Spark simply has nothing to take — it still resolves (and is
    // still sent to the Abyss), it just does nothing.
    function resolveReversal(pNum) {
        const board = document.getElementById(`player-${pNum}`);
        if (!board) return;
        const historyPile = board.querySelector('.history-pile');
        if (!historyPile) return;

        let history = [];
        try { history = JSON.parse(historyPile.dataset.cardData || '[]'); } catch (e) { /* empty */ }
        if (history.length === 0) return;

        const takeCardAt = (idx) => {
            const [taken] = history.splice(idx, 1);
            if (history.length === 0) {
                clearStackSlot(historyPile, 'History');
            } else {
                historyPile.dataset.cardData = JSON.stringify(history);
                const newTop = history[history.length - 1];
                const art = cardArtUrl(newTop);
                if (art) {
                    historyPile.style.backgroundImage = `url('${art}')`;
                } else {
                    historyPile.style.backgroundImage = '';
                    historyPile.style.backgroundColor = 'rgba(255,255,255,0.1)';
                    historyPile.textContent = newTop.name;
                }
                bindHoverToElement(historyPile, newTop);
                updateStackIndicator(historyPile);
            }

            const handSlots = Array.from(board.querySelectorAll('.hand-slot'));
            let targetSlot = handSlots.find(s => s.classList.contains('slot-empty'));
            if (!targetSlot) {
                targetSlot = createSlot('hand');
                targetSlot.classList.add('temporary-slot');
                board.querySelector('.hand-slots').appendChild(targetSlot);
            }
            finishSingleCardPlacement(targetSlot, taken);
            updateHandLayout(pNum);
            floatValue(targetSlot, `+ ${taken.name}`, 'gain');
        };

        if (history.length === 1) { takeCardAt(0); return; }

        // 2+ cards in History — let the player pick which one comes back.
        const overlay = document.createElement('div');
        overlay.className = 'overlay landmark-choice-overlay';
        const panel = document.createElement('div');
        panel.className = 'glass-panel landmark-choice-panel';
        const title = document.createElement('div');
        title.className = 'fantasy-font glowing-text landmark-choice-title';
        title.textContent = 'Reversal — Take Which Card?';
        panel.appendChild(title);
        history.forEach((c, idx) => {
            const btn = document.createElement('button');
            btn.className = 'menu-btn tech-font';
            btn.textContent = c.name;
            btn.onclick = () => { overlay.remove(); takeCardAt(idx); };
            panel.appendChild(btn);
        });
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    }

    // Threat: Send an active Landmark of your choice to the Abyss, unless its owner pays
    // 2 Time Points for each Landmark they own. "Of your choice" means ANY Landmark in play —
    // including your own (e.g. torching your own Meridius-boosting Landmark on purpose).
    function allLandmarksInPlay() {
        const found = [];
        for (let p = 1; p <= activePlayerCount; p++) {
            const board = document.getElementById(`player-${p}`);
            if (!board) continue;
            board.querySelectorAll('.landmark-zone-main .card:not(.slot-empty)').forEach(slot => {
                found.push({ slot, owner: p });
            });
        }
        return found;
    }

    function resolveThreat() {
        const targets = allLandmarksInPlay();
        if (targets.length === 0) return; // nothing in play to threaten
        if (targets.length === 1) { beginThreatChoice(targets[0]); return; }
        promptThreatTarget(targets);
    }

    // 2+ Landmarks in play — let the caster click which one to threaten (any board, any owner).
    function promptThreatTarget(targets) {
        const cleanup = () => targets.forEach(t => {
            t.slot.classList.remove('threat-target');
            if (t.slot._threatHandler) t.slot.removeEventListener('click', t.slot._threatHandler, true);
            delete t.slot._threatHandler;
        });
        targets.forEach(t => {
            t.slot.classList.add('threat-target');
            const handler = (e) => {
                e.stopPropagation();
                e.preventDefault();
                cleanup();
                beginThreatChoice(t);
            };
            t.slot._threatHandler = handler;
            t.slot.addEventListener('click', handler, true); // capture: preempt the normal landmark click
        });
    }

    // The target is chosen — its owner may pay 2 TP per Landmark they currently own to keep it.
    function beginThreatChoice(target) {
        const { slot, owner } = target;
        let cardData;
        try { cardData = JSON.parse(slot.dataset.cardData); } catch (e) { return; }

        const landmarkCount = countLandmarks(owner);
        const cost = landmarkCount * 2;
        const canPay = totalTimePoints(owner) >= cost;

        const overlay = document.createElement('div');
        overlay.className = 'overlay landmark-choice-overlay';
        const panel = document.createElement('div');
        panel.className = 'glass-panel landmark-choice-panel';
        const title = document.createElement('div');
        title.className = 'fantasy-font glowing-text landmark-choice-title';
        title.textContent = `Threat — ${cardData.name} (P${owner})`;
        panel.appendChild(title);

        const desc = document.createElement('div');
        desc.className = 'tech-font';
        desc.style.cssText = 'font-size:11px;opacity:0.75;margin:-6px 0 4px;';
        desc.textContent = `P${owner} may pay ${cost} TP (2 × ${landmarkCount} Landmark${landmarkCount === 1 ? '' : 's'} owned) to keep it.`;
        panel.appendChild(desc);

        const btnPay = document.createElement('button');
        btnPay.className = 'menu-btn tech-font';
        btnPay.textContent = `Pay ${cost} TP`;
        btnPay.disabled = !canPay;
        btnPay.style.opacity = canPay ? '1' : '0.5';
        btnPay.onclick = () => {
            if (!canPay) return;
            overlay.remove();
            resolveDamageDirectly(cost, owner);
            floatValue(slot, `-${cost} TP`, 'damage');
        };
        panel.appendChild(btnPay);

        const btnDecline = document.createElement('button');
        btnDecline.className = 'menu-btn secondary-btn tech-font';
        btnDecline.textContent = 'Send to Abyss';
        btnDecline.onclick = () => {
            overlay.remove();
            const abyssEl = document.querySelector('.card--abyss');
            clearSlot(slot);
            finishSingleCardPlacement(abyssEl, cardData);
            floatValue(abyssEl, `${cardData.name} Lost`, 'damage');
        };
        panel.appendChild(btnDecline);

        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        // Threat aimed at the Computer's Landmark: it decides pay-or-lose itself.
        if (vsComputer && owner === AI_PLAYER) {
            aiHandleThreat({ overlay, btnPay, btnDecline, canPay, cost, cardName: cardData.name });
        }
    }

    // Alchemy: A Player of your choice has to discard all Cards from their Landmark Zone.
    // "A Player of your choice" INCLUDES yourself, so the picker offers every seat (unlike
    // Confiscation/Dark Matter, which target opponents only) — you may torch your own Landmarks
    // on purpose, or pick a player who owns none (a legal, empty choice). Always ask.
    function resolveAlchemy(casterPNum) {
        const overlay = document.createElement('div');
        overlay.className = 'overlay landmark-choice-overlay';
        const panel = document.createElement('div');
        panel.className = 'glass-panel landmark-choice-panel';
        const title = document.createElement('div');
        title.className = 'fantasy-font glowing-text landmark-choice-title';
        title.textContent = 'Alchemy — Which Player Discards Their Landmarks?';
        panel.appendChild(title);

        for (let p = 1; p <= activePlayerCount; p++) {
            const count = countLandmarks(p);
            const btn = document.createElement('button');
            btn.className = 'menu-btn tech-font';
            const selfTag = p === casterPNum ? ' (You)' : '';
            btn.textContent = `Player ${p}${selfTag} — ${count} Landmark${count === 1 ? '' : 's'}`;
            const pNum = p;
            btn.onclick = () => { overlay.remove(); discardAllLandmarks(pNum); };
            panel.appendChild(btn);
        }
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    }

    // Discard every Landmark in a player's Landmark Zone to their OWN History Pile. Alchemy says
    // "discard" (not Threat's explicit "to the Abyss"), and in this engine a discarded Landmark
    // routes to History — so, exactly like a Hyperscope-destroyed Landmark, each one cycles and
    // rebuilds itself on a later draw (a tempo hit, not permanent removal). clearSlot is the
    // shared teardown chokepoint, so Atlantica parked cards and Hand of Rhone charges clean up
    // with their Landmark. Atlantica "cannot be deactivated" but IS discardable, so it goes too.
    function discardAllLandmarks(ownerNum) {
        const board = document.getElementById(`player-${ownerNum}`);
        if (!board) return;
        const ownerHistory = board.querySelector('.history-pile');
        const slots = Array.from(board.querySelectorAll('.landmark-zone-main .card:not(.slot-empty)'));
        slots.forEach(slot => {
            let card; try { card = JSON.parse(slot.dataset.cardData); } catch (e) { return; }
            floatValue(slot, `${card.name} Discarded`, 'damage');
            clearSlot(slot);
            finishSingleCardPlacement(ownerHistory, card);
        });
    }

    // Tame Beast: Reduce the Health Points of any Creature in play to 1 and gain the deducted
    // Time Points. "Health Points" is the Creature's current effective HP (base + Cabin/Meridia
    // buffs − damage already taken). The reduction is applied AS DAMAGE — the engine's single-HP
    // model, so it drops both attack Strength and block Resistance together (and, like any damage,
    // a later heal could restore it). The caster gains TP equal to how much HP was removed
    // (oldHP − 1). Face-down Creatures aren't targetable — their stats are a mystery, same rule
    // as Hyperscope aiming.
    function tameBeastTargets() {
        const found = [];
        for (let p = 1; p <= activePlayerCount; p++) {
            const board = document.getElementById(`player-${p}`);
            if (!board) continue;
            board.querySelectorAll('.creature-zone-main .card:not(.slot-empty)').forEach(slot => {
                let c; try { c = JSON.parse(slot.dataset.cardData); } catch (e) { return; }
                if (Array.isArray(c) || c.type !== 'Creature' || c.deactivated) return;
                found.push({ slot, owner: p });
            });
        }
        return found;
    }

    function resolveTameBeast(casterPNum) {
        const targets = tameBeastTargets();
        if (targets.length === 0) return; // no Creature in play — the Spark fizzles
        if (targets.length === 1) { applyTameBeast(targets[0], casterPNum); return; }

        // 2+ Creatures — pulse each (red threat-target glow) behind a docked hint and let the
        // caster click one. No CANCEL: a Spark is committed once bought (same as Threat).
        const bar = document.createElement('div');
        bar.id = 'tame-beast-bar';
        bar.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:6000;';
        const hint = document.createElement('div');
        hint.className = 'menu-btn tech-font';
        hint.style.cssText = 'pointer-events:none;opacity:0.85;';
        hint.textContent = 'TAME BEAST — CHOOSE ANY CREATURE';
        bar.appendChild(hint);
        document.body.appendChild(bar);

        const cleanup = () => {
            targets.forEach(t => {
                t.slot.classList.remove('threat-target');
                if (t.slot._tameHandler) t.slot.removeEventListener('click', t.slot._tameHandler, true);
                delete t.slot._tameHandler;
            });
            bar.remove();
        };
        targets.forEach(t => {
            t.slot.classList.add('threat-target');
            const handler = (e) => {
                e.stopPropagation();
                e.preventDefault();
                cleanup();
                applyTameBeast(t, casterPNum);
            };
            t.slot._tameHandler = handler;
            t.slot.addEventListener('click', handler, true); // capture: preempt the normal creature click
        });
    }

    function applyTameBeast(target, casterPNum) {
        const { slot } = target;
        let card; try { card = JSON.parse(slot.dataset.cardData); } catch (e) { return; }

        const base = parseInt(card.baseResistance ?? card.baseHealth ?? card.resistance ?? card.health) || 0;
        let bonus = cabinBonus(slot.closest('.player-zone'));
        if (card.name === 'Meridia') bonus += meridiaArtifactBonus(slot.closest('.player-zone').querySelector('.history-pile'));
        const currentHp = Math.max(0, base + bonus - (card.damageTaken || 0));
        const removed = Math.max(0, currentHp - 1);

        // Bring the Creature down to 1 HP by applying (HP − 1) damage.
        card.damageTaken = (card.damageTaken || 0) + removed;
        slot.dataset.cardData = JSON.stringify(card);
        updateCreatureVisuals(slot);
        floatValue(slot, 'Tamed → 1 HP', 'damage');

        // Gain Time Points equal to the HP removed (respects the 12 cap and the active die).
        if (removed > 0) {
            gainTimePoints(casterPNum, removed);
            const board = document.getElementById(`player-${casterPNum}`);
            if (board) floatValue(board.querySelector(activeDieSel(casterPNum)), `+${removed} TP`, 'gain');
        }
    }

    // Tele Control: Use an active Creature to attack a Player of your choice. The controlled
    // Creature is NOT discarded — it overrides the normal "attacked → to History" spend and stays
    // in its owner's zone. You may commandeer EITHER board's Creature; the point of the card is to
    // turn an opponent's Creature against them. "Active" = face-up and able to act (past summoning
    // sickness; Cravus/Rampadon count the turn they arrive) — the same canAct rule the attack flow
    // and the AI use.
    function teleControlTargets() {
        const found = [];
        for (let p = 1; p <= activePlayerCount; p++) {
            const board = document.getElementById(`player-${p}`);
            if (!board) continue;
            board.querySelectorAll('.creature-zone-main .card:not(.slot-empty)').forEach(slot => {
                let c; try { c = JSON.parse(slot.dataset.cardData); } catch (e) { return; }
                if (Array.isArray(c) || c.type !== 'Creature' || c.deactivated) return;
                const canAct = (c.summonedOnTurn < totalTurns) || c.name.includes('Cravus') || c.name.includes('Rampadon');
                if (!canAct) return;
                found.push({ slot, owner: p });
            });
        }
        return found;
    }

    function resolveTeleControl(casterPNum) {
        const targets = teleControlTargets();
        if (targets.length === 0) return; // no active Creature anywhere — the Spark fizzles
        if (targets.length === 1) { chooseTeleControlTarget(targets[0].slot, casterPNum); return; }

        // 2+ active Creatures — pulse each (red threat-target glow) behind a docked hint and let
        // the caster click which one to command. No CANCEL: a Spark is committed once bought.
        const bar = document.createElement('div');
        bar.id = 'tele-control-bar';
        bar.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:6000;';
        const hint = document.createElement('div');
        hint.className = 'menu-btn tech-font';
        hint.style.cssText = 'pointer-events:none;opacity:0.85;';
        hint.textContent = 'TELE CONTROL — CHOOSE A CREATURE TO COMMAND';
        bar.appendChild(hint);
        document.body.appendChild(bar);

        const cleanup = () => {
            targets.forEach(t => {
                t.slot.classList.remove('threat-target');
                if (t.slot._teleHandler) t.slot.removeEventListener('click', t.slot._teleHandler, true);
                delete t.slot._teleHandler;
            });
            bar.remove();
        };
        targets.forEach(t => {
            t.slot.classList.add('threat-target');
            const handler = (e) => {
                e.stopPropagation();
                e.preventDefault();
                cleanup();
                chooseTeleControlTarget(t.slot, casterPNum);
            };
            t.slot._teleHandler = handler;
            t.slot.addEventListener('click', handler, true); // capture: preempt the normal creature click
        });
    }

    // Pick which Player the commandeered Creature strikes. "A Player of your choice" is literal —
    // every seat is offered (you may even aim it at yourself), so a controlled opponent Creature
    // can be turned on its own owner.
    function chooseTeleControlTarget(creatureSlot, casterPNum) {
        const overlay = document.createElement('div');
        overlay.className = 'overlay landmark-choice-overlay';
        const panel = document.createElement('div');
        panel.className = 'glass-panel landmark-choice-panel';
        const title = document.createElement('div');
        title.className = 'fantasy-font glowing-text landmark-choice-title';
        title.textContent = 'Tele Control — Attack Which Player?';
        panel.appendChild(title);
        for (let p = 1; p <= activePlayerCount; p++) {
            const btn = document.createElement('button');
            btn.className = 'menu-btn tech-font';
            btn.textContent = `Player ${p}${p === casterPNum ? ' (You)' : ''}`;
            const target = p;
            btn.onclick = () => { overlay.remove(); launchTeleControlAttack(creatureSlot, target); };
            panel.appendChild(btn);
        }
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    }

    // Run the commandeered strike through the normal attack pipeline (beginAttack → Entrophy /
    // Meridius scaling → defense screen), tagged teleControlled so finishAttacker keeps the
    // Creature in its zone afterward instead of discarding it.
    function launchTeleControlAttack(creatureSlot, targetPNum) {
        let card; try { card = JSON.parse(creatureSlot.dataset.cardData); } catch (e) { return; }
        beginAttack({ ...card, teleControlled: true }, creatureSlot, targetPNum);
    }

    // Burden of Wealth: Target damage to a Player equal to the Cards in their Hand. They may
    // reduce the damage by discarding Cards, from MOST EXPENSIVE to least (1 damage per Card).
    //
    // Expensiveness (per the printed card) is measured FIRST by total Steams used (the pip count
    // of a Card's Bazaar cost), THEN by the value of those Steams (Laser > Gold > Fire > AllSteam):
    // "FFL beats GGG" (equal count, but a Laser outranks Golds) and "FFF beats GL" (3 pips beats 2,
    // count dominates). NOTE this is the OPPOSITE priority to cardCostValue() (the internal
    // auto-discard heuristic, where tier dominates count), so Burden needs its own comparator.
    // Steam Cards rank by their own Bazaar cost too (LaserSteam 'FGG' > GoldSteam 'AAA' > FireSteam
    // '-'), which lands them in a sensible order with no special-casing.
    function burdenExpensiveness(card) {
        const cost = (card && card.cost) ? String(card.cost) : '';
        let nF = 0, nG = 0, nL = 0, nA = 0;
        for (const ch of cost) {
            if (ch === 'F') nF++;
            else if (ch === 'G') nG++;
            else if (ch === 'L') nL++;
            else if (ch === 'A') nA++;
        }
        const total = nF + nG + nL + nA;
        // total (pip count) dominates; ties broken by Laser count, then Gold, then Fire, then All.
        return total * 1e8 + nL * 1e6 + nG * 1e4 + nF * 1e2 + nA;
    }

    function resolveBurden(casterPNum) {
        // "Target ... a Player" — offer every seat (self included, faithful to the wording).
        const overlay = document.createElement('div');
        overlay.className = 'overlay landmark-choice-overlay';
        const panel = document.createElement('div');
        panel.className = 'glass-panel landmark-choice-panel';
        const title = document.createElement('div');
        title.className = 'fantasy-font glowing-text landmark-choice-title';
        title.textContent = 'Burden of Wealth — Target Which Player?';
        panel.appendChild(title);
        for (let p = 1; p <= activePlayerCount; p++) {
            const count = document.getElementById(`player-${p}`).querySelectorAll('.hand-slot:not(.slot-empty)').length;
            const btn = document.createElement('button');
            btn.className = 'menu-btn tech-font';
            btn.textContent = `Player ${p}${p === casterPNum ? ' (You)' : ''} — ${count} Card${count === 1 ? '' : 's'}`;
            const target = p;
            btn.onclick = () => { overlay.remove(); beginBurden(target); };
            panel.appendChild(btn);
        }
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    }

    // The target is chosen — damage = their hand size. Sort their Hand most-expensive-first; the
    // target decides how many of those top Cards to discard (each −1 damage). Human targets get a
    // stepper overlay; the Computer decides for itself (keeps its Cards unless the hit is lethal).
    function beginBurden(targetPNum) {
        const board = document.getElementById(`player-${targetPNum}`);
        if (!board) return;
        const ranked = Array.from(board.querySelectorAll('.hand-slot:not(.slot-empty)'))
            .map(slot => { let c; try { c = JSON.parse(slot.dataset.cardData); } catch (e) { c = {}; } return { slot, card: c }; })
            .sort((a, b) => burdenExpensiveness(b.card) - burdenExpensiveness(a.card)); // most expensive first
        const N = ranked.length;
        if (N === 0) return; // empty Hand → 0 damage, the Spark fizzles

        if (vsComputer && targetPNum === AI_PLAYER) {
            // AI hoards its Cards — discard only enough (of the most expensive) to survive a
            // lethal hit; otherwise take the whole thing.
            const tp = totalTimePoints(targetPNum);
            const k = N >= tp ? Math.min(N, N - tp + 1) : 0;
            applyBurden(targetPNum, ranked, k);
            return;
        }
        promptBurdenDiscard(targetPNum, ranked);
    }

    // Human target's decision: a stepper over how many of the most-expensive Cards to discard,
    // with the ordered Hand shown (top Cards highlighted as they're selected) and a live damage
    // readout. Enforces most-expensive-first by construction — you can only discard the top k.
    function promptBurdenDiscard(targetPNum, ranked) {
        const N = ranked.length;
        let k = 0;

        const overlay = document.createElement('div');
        overlay.className = 'overlay landmark-choice-overlay';
        const panel = document.createElement('div');
        panel.className = 'glass-panel landmark-choice-panel';
        panel.style.maxWidth = '460px';

        const title = document.createElement('div');
        title.className = 'fantasy-font glowing-text landmark-choice-title';
        title.textContent = `Burden of Wealth — Player ${targetPNum}`;
        panel.appendChild(title);

        const sub = document.createElement('div');
        sub.className = 'tech-font';
        sub.style.cssText = 'font-size:11px;opacity:0.8;margin:-4px 0 8px;';
        sub.textContent = `You take ${N} damage — 1 per Card in Hand. Discard your most expensive Cards (in order) to reduce it, 1 damage each.`;
        panel.appendChild(sub);

        const list = document.createElement('div');
        list.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:8px;';
        const chips = ranked.map(({ card }, i) => {
            const chip = document.createElement('div');
            chip.className = 'tech-font';
            chip.style.cssText = 'padding:4px 8px;border:1px solid rgba(255,255,255,0.25);border-radius:6px;font-size:11px;cursor:pointer;transition:all .12s;';
            chip.textContent = `${card.name || '?'}${card.cost && card.cost !== '-' ? ` (${card.cost})` : ''}`;
            // Click a Card to discard the whole prefix up to it; click the current boundary to step back one.
            chip.onclick = () => { k = (k === i + 1) ? i : i + 1; render(); };
            list.appendChild(chip);
            return chip;
        });
        panel.appendChild(list);

        const readout = document.createElement('div');
        readout.className = 'tech-font';
        readout.style.cssText = 'font-size:13px;margin-bottom:8px;';
        panel.appendChild(readout);

        const render = () => {
            chips.forEach((chip, i) => {
                const on = i < k;
                chip.style.background = on ? 'rgba(255,90,90,0.35)' : 'transparent';
                chip.style.borderColor = on ? 'rgba(255,90,90,0.9)' : 'rgba(255,255,255,0.25)';
                chip.style.textDecoration = on ? 'line-through' : 'none';
                chip.style.opacity = on ? '0.7' : '1';
            });
            readout.innerHTML = `Discard <b>${k}</b> → Take <b>${N - k}</b> damage`;
        };
        render();

        const confirm = document.createElement('button');
        confirm.className = 'menu-btn tech-font';
        confirm.textContent = 'CONFIRM';
        confirm.onclick = () => { overlay.remove(); applyBurden(targetPNum, ranked, k); };
        panel.appendChild(confirm);

        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    }

    // Resolve: discard the k most-expensive Cards to the target's History, then deal the remaining
    // (N − k) damage to the target through the standard direct-damage path (active die first).
    function applyBurden(targetPNum, ranked, k) {
        const board = document.getElementById(`player-${targetPNum}`);
        if (!board) return;
        const history = board.querySelector('.history-pile');
        for (let i = 0; i < k; i++) {
            const { slot, card } = ranked[i];
            floatValue(slot, `${card.name} Discarded`, 'damage');
            clearSlot(slot);
            finishSingleCardPlacement(history, card);
        }
        updateHandLayout(targetPNum);

        const damage = ranked.length - k;
        if (damage > 0) {
            resolveDamageDirectly(damage, targetPNum);
            const dieSel = activeDieSel(targetPNum);
            floatValue(board.querySelector(dieSel), `-${damage} TP`, 'damage');
        }
    }

    // Confiscation: Look at target Opponent's Hand and take one Card to your Hand.
    // 2-player V1: the opponent is automatic. With 3-4 players, reuse the same
    // target-player-overlay the attack flow and Dark Matter already use to pick which one.
    function resolveConfiscation(casterPNum) {
        if (activePlayerCount === 2) {
            const opponent = casterPNum === 1 ? 2 : 1;
            showConfiscationPicker(casterPNum, opponent);
        } else {
            const overlay = document.getElementById('target-player-overlay');
            const list = document.getElementById('target-player-list');
            list.innerHTML = '';
            for (let i = 1; i <= activePlayerCount; i++) {
                if (i === casterPNum) continue;
                const circle = document.createElement('div');
                circle.className = `target-circle p${i}`;
                circle.textContent = `P${i}`;
                circle.onclick = () => {
                    overlay.classList.add('hidden');
                    showConfiscationPicker(casterPNum, i);
                };
                list.appendChild(circle);
            }
            overlay.classList.remove('hidden');
        }
    }

    // The opponent is chosen — look at their Hand and take one Card. Auto-resolves with one
    // card in Hand; otherwise shows every card in that Hand (the "look at" part) to pick from.
    // A no-op if their Hand is empty.
    function showConfiscationPicker(casterPNum, targetPNum) {
        const targetBoard = document.getElementById(`player-${targetPNum}`);
        if (!targetBoard) return;
        const handSlots = Array.from(targetBoard.querySelectorAll('.hand-slot:not(.slot-empty)'));
        if (handSlots.length === 0) return;

        const takeFrom = (slot) => {
            let data;
            try { data = JSON.parse(slot.dataset.cardData); } catch (e) { return; }
            clearSlot(slot);
            updateHandLayout(targetPNum);

            const casterBoard = document.getElementById(`player-${casterPNum}`);
            const casterHandSlots = Array.from(casterBoard.querySelectorAll('.hand-slot'));
            let dest = casterHandSlots.find(s => s.classList.contains('slot-empty'));
            if (!dest) {
                dest = createSlot('hand');
                dest.classList.add('temporary-slot');
                casterBoard.querySelector('.hand-slots').appendChild(dest);
            }
            finishSingleCardPlacement(dest, data);
            updateHandLayout(casterPNum);
            floatValue(dest, `+ ${data.name}`, 'gain');
        };

        if (handSlots.length === 1) { takeFrom(handSlots[0]); return; }

        const overlay = document.createElement('div');
        overlay.className = 'overlay landmark-choice-overlay';
        const panel = document.createElement('div');
        panel.className = 'glass-panel landmark-choice-panel';
        const title = document.createElement('div');
        title.className = 'fantasy-font glowing-text landmark-choice-title';
        title.textContent = `Confiscation — P${targetPNum}'s Hand`;
        panel.appendChild(title);
        handSlots.forEach(slot => {
            let data;
            try { data = JSON.parse(slot.dataset.cardData); } catch (e) { return; }
            const btn = document.createElement('button');
            btn.className = 'menu-btn tech-font';
            btn.textContent = data.name;
            btn.onclick = () => { overlay.remove(); takeFrom(slot); };
            panel.appendChild(btn);
        });
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    }

    // --- Planetarium staging ---
    // Each discard adds one to the staged count and arms the landmark (persistent glow +
    // "Draw N" badge). Draws happen all at once on commit, so you can't cherry-pick draws.
    function stagePlanetarium() {
        planetariumStaged += 1;
        armPlanetarium();
    }
    function armPlanetarium() {
        const el = findLandmark(currentPlayer, 'Planetarium');
        if (!el) return;
        el.classList.add('planetarium-armed');
        let badge = el.querySelector('.planetarium-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'planetarium-badge tech-font';
            el.appendChild(badge);
        }
        badge.textContent = `▶ Draw ${planetariumStaged}`;
        if (!el._planetariumHandler) {
            // Only the lower third of the armed card commits the draw; the upper two-thirds
            // stay a drop zone so you can keep staging more cards onto it. While you're
            // holding a card, any click here is a placement (stage one more), never a commit.
            el._planetariumHandler = (e) => {
                if (heldCards.length > 0) return; // placing a card -> let it bubble to placeCard
                const rect = el.getBoundingClientRect();
                const inLowerThird = (e.clientY - rect.top) >= rect.height * (2 / 3);
                e.stopPropagation();
                e.preventDefault();
                if (inLowerThird) commitPlanetarium();
            };
            el.addEventListener('click', el._planetariumHandler, true); // capture: preempt normal click
        }
    }
    function disarmPlanetarium() {
        const el = findLandmark(currentPlayer, 'Planetarium');
        if (!el) return;
        el.classList.remove('planetarium-armed');
        const badge = el.querySelector('.planetarium-badge');
        if (badge) badge.remove();
        if (el._planetariumHandler) {
            el.removeEventListener('click', el._planetariumHandler, true);
            delete el._planetariumHandler;
        }
    }
    async function commitPlanetarium() {
        const n = planetariumStaged;
        if (n <= 0) return;
        planetariumStaged = 0;
        planetariumUsedThisTurn = true;
        disarmPlanetarium();
        pulseLandmark(currentPlayer, 'Planetarium');
        await drawCards(currentPlayer, n);
    }

    // --- Lethargo's Temple: buy a card with Time Points instead of Steam ---
    // Once per Construction Phase. Click the Temple to arm TP-buy mode; a context window
    // offers a payment toggle (Steam+TP vs Only TP). Buying spends steam first (unless
    // Only-TP), covering the rest with Time Points off the Day die.

    function countHandSteams(pNum) {
        const board = document.getElementById(`player-${pNum}`);
        const counts = { F: 0, G: 0, L: 0 };
        if (!board) return counts;
        board.querySelectorAll('.hand-slot:not(.slot-empty), .atlantica-slot:not(.slot-empty)').forEach(s => {
            try {
                const d = JSON.parse(s.dataset.cardData);
                if (d.number === 'STM1') counts.F++;
                else if (d.number === 'STM2') counts.G++;
                else if (d.number === 'STM3') counts.L++;
            } catch (e) { /* skip */ }
        });
        return counts;
    }

    // Plan a Temple purchase: which steam cards to spend + how many TP. Steam-first unless
    // Only-TP mode. Returns { tp, steamTypes } where steamTypes are the steam cards to spend.
    function planLethargoPayment(card) {
        const need = { F: 0, G: 0, L: 0, A: 0 };
        for (const ch of (card.cost || '')) if (need[ch] !== undefined) need[ch]++;
        const TP = { F: 1, G: 2, L: 3, A: 1 };

        if (lethargoOnlyTP) {
            return { tp: need.F * TP.F + need.G * TP.G + need.L * TP.L + need.A * TP.A, steamTypes: [] };
        }

        const avail = countHandSteams(currentPlayer);
        const steamTypes = [];
        let tp = 0;
        const useOrTP = (type, tpCost) => {
            if (avail[type] > 0) { avail[type]--; steamTypes.push(type); }
            else tp += tpCost;
        };
        for (let i = 0; i < need.F; i++) useOrTP('F', TP.F);
        for (let i = 0; i < need.G; i++) useOrTP('G', TP.G);
        for (let i = 0; i < need.L; i++) useOrTP('L', TP.L);
        for (let i = 0; i < need.A; i++) { // AllSteam: any steam, cheapest first
            if (avail.F > 0) { avail.F--; steamTypes.push('F'); }
            else if (avail.G > 0) { avail.G--; steamTypes.push('G'); }
            else if (avail.L > 0) { avail.L--; steamTypes.push('L'); }
            else tp += TP.A;
        }
        return { tp, steamTypes };
    }

    function toggleLethargo() {
        if (lethargoUsedThisPhase) return; // once per Construction Phase
        lethargoActive = !lethargoActive;
        if (lethargoActive) openLethargoContext();
        else closeLandmarkContext();
        pulseLandmark(currentPlayer, "Lethargo's Temple");
        updateBazaarLighting();
    }

    function deactivateLethargo() {
        lethargoActive = false;
        closeLandmarkContext();
        hideTpCostHint();
        updateBazaarLighting();
    }

    function openLethargoContext() {
        const win = document.getElementById('landmark-context');
        const title = document.getElementById('landmark-context-title');
        const body = document.getElementById('landmark-context-body');
        if (!win || !title || !body) return;
        title.textContent = "Lethargo's Temple";
        body.innerHTML = '';
        const row = document.createElement('div');
        row.className = 'landmark-context-row';
        const label = document.createElement('div');
        label.className = 'landmark-context-label';
        label.textContent = 'Payment method';
        const btn = document.createElement('button');
        btn.className = 'landmark-toggle-btn';
        const sync = () => { btn.textContent = lethargoOnlyTP ? 'Only Time Points' : 'Steam + Time Points'; };
        sync();
        btn.onclick = () => { lethargoOnlyTP = !lethargoOnlyTP; sync(); hideTpCostHint(); updateLethargoViewed(lethargoViewedCard); updateBazaarLighting(); };
        row.appendChild(label);
        row.appendChild(btn);
        body.appendChild(row);

        // Viewed-card readout: name + payment breakdown for whatever card is hovered.
        const viewed = document.createElement('div');
        viewed.id = 'landmark-context-viewed';
        viewed.className = 'landmark-context-viewed';
        body.appendChild(viewed);
        updateLethargoViewed(null);

        win.classList.remove('hidden');
    }

    // Format a Temple purchase as e.g. "2 Fire + 4 TP" (steam cards spent, then TP).
    function formatLethargoBreakdown(card) {
        const plan = planLethargoPayment(card);
        const counts = { F: 0, G: 0, L: 0 };
        plan.steamTypes.forEach(t => counts[t]++);
        const parts = [];
        if (counts.F) parts.push(`${counts.F} Fire`);
        if (counts.G) parts.push(`${counts.G} Gold`);
        if (counts.L) parts.push(`${counts.L} Laser`);
        if (plan.tp > 0) parts.push(`${plan.tp} TP`);
        return parts.length ? parts.join(' + ') : 'Free';
    }

    // Update the context window's viewed-card readout (null clears it to a hint).
    function updateLethargoViewed(card) {
        lethargoViewedCard = card;
        const el = document.getElementById('landmark-context-viewed');
        if (!el) return;
        if (!card || !card.name || !card.cost || card.cost === '-') {
            el.innerHTML = '<span class="lc-viewed-hint">Hover a card to see its cost</span>';
            return;
        }
        el.innerHTML =
            `<div class="lc-viewed-name">${card.name}</div>` +
            `<div class="lc-viewed-cost">${formatLethargoBreakdown(card)}</div>`;
    }

    function closeLandmarkContext() {
        const win = document.getElementById('landmark-context');
        if (win) win.classList.add('hidden');
    }

    // Execute a Temple purchase: spend planned steam cards to History + TP off the dice.
    function payWithLethargo(card) {
        const plan = planLethargoPayment(card);
        const board = document.getElementById(`player-${currentPlayer}`);
        const historySlot = board && board.querySelector('.history-pile');
        if (!board || !historySlot) return;

        // Spend the planned steam cards (leftmost matching of each type).
        const used = new Set();
        plan.steamTypes.forEach((type, idx) => {
            const num = type === 'F' ? 'STM1' : type === 'G' ? 'STM2' : 'STM3';
            const slot = Array.from(board.querySelectorAll('.hand-slot:not(.slot-empty), .atlantica-slot:not(.slot-empty)')).find(s => {
                if (used.has(s)) return false;
                try { return JSON.parse(s.dataset.cardData).number === num; } catch (e) { return false; }
            });
            if (slot) {
                used.add(slot);
                const data = JSON.parse(slot.dataset.cardData);
                animateCardToHistory(slot, historySlot, data, idx * 100);
                clearSlot(slot);
            }
        });

        // Spend Time Points (Day die first) with a floating readout on the dice.
        if (plan.tp > 0) {
            const dieSel = activeDieSel(currentPlayer);
            resolveDamageDirectly(plan.tp, currentPlayer);
            floatValue(board.querySelector(dieSel), `-${plan.tp} TP`, 'damage');
        }

        lethargoUsedThisPhase = true;
        deactivateLethargo();
    }

    // Hover readout: show a card's Temple TP cost while the Temple is armed.
    function showTpCostHint(cardContainer, card) {
        hideTpCostHint();
        if (!lethargoActive || !card || !card.cost || card.cost === '-') return;
        const plan = planLethargoPayment(card);
        if (plan.tp <= 0) return;
        const rect = cardContainer.getBoundingClientRect();
        const hint = document.createElement('div');
        hint.className = 'tp-cost-hint';
        hint.id = 'tp-cost-hint';
        hint.textContent = `${plan.tp} TP`;
        hint.style.left = `${rect.left + rect.width / 2}px`;
        hint.style.top = `${rect.top - 6}px`;
        document.body.appendChild(hint);
    }
    function hideTpCostHint() {
        const h = document.getElementById('tp-cost-hint');
        if (h) h.remove();
    }

    // Fully heal a damaged creature (reset damageTaken), with feedback.
    function healCreature(slot) {
        try {
            const card = JSON.parse(slot.dataset.cardData);
            card.damageTaken = 0;
            slot.dataset.cardData = JSON.stringify(card);
            updateCreatureVisuals(slot);
            pulseLandmark(currentPlayer, "Dragura's Wasteland");
            floatValue(slot, 'Healed', 'gain');
        } catch (e) { /* skip */ }
    }

    // When more than one creature is damaged, let the player click which to heal.
    function promptHealTarget(slots) {
        const cleanup = () => slots.forEach(s => {
            s.classList.remove('heal-target');
            if (s._healHandler) s.removeEventListener('click', s._healHandler, true);
            delete s._healHandler;
        });
        slots.forEach(s => {
            s.classList.add('heal-target');
            const handler = (e) => {
                e.stopPropagation();
                e.preventDefault();
                cleanup();
                healCreature(s);
            };
            s._healHandler = handler;
            s.addEventListener('click', handler, true); // capture: preempt the normal creature click
        });
    }

    function adjustPlayerDie(pNum, type, delta) {
        // "Once a die is lost (at 0), it can't be brought back"
        if (playersState[pNum][type] <= 0 && delta > 0) return;

        playersState[pNum][type] = Math.max(0, Math.min(12, playersState[pNum][type] + delta));
        updatePlayerDieUI(pNum, type);
    }

    // --- Quick Help Logic ---
    let helpActive = false;
    const helpData = {
        'abyss': { title: 'Abyss', desc: 'VOID ZONE. Cards cast into the Abyss are removed from the current timeline.' },
        'steam-red': { title: 'Fire Steam', desc: 'RESOURCES. Used primarily to acquire aggressive or high-damage cards.' },
        'steam-gold': { title: 'Gold Steam', desc: 'RESOURCES. Used for construction and high-tier landmarks.' },
        'steam-pink': { title: 'Laser Steam', desc: 'RESOURCES. Used for precision tools and advanced artifact tech.' },
        'destiny': { title: 'Destiny', desc: 'GLOBAL EVENTS. Cards that alter the fundamental laws of the current session.' },
        'landmark': { title: 'Landmark', desc: 'STRUCTURES. Permanent cards that provide ongoing passive benefits.' },
        'creature': { title: 'Creature', desc: 'MINIONS. Your primary units for combat, defense, and objective control.' },
        'artifact': { title: 'Artifact', desc: 'UTILITY. Persistent tools that can be activated for unique abilities.' },
        'spark': { title: 'Spark', desc: 'INSTANT. One-time effects that resolve and go to History immediately.' },
        'history': { title: 'History', desc: 'DISCARD. Where used sparks and destroyed landmarks or creatures reside.' },
        'future': { title: 'Future', desc: 'DECK. Your upcoming potential. Draw cards from here into your hand.' },
        'day-die': { title: 'Day Counter', desc: 'TIME TRACKER. Tracks the sunlight or brightness level. Influences specific cards.' },
        'night-die': { title: 'Night Counter', desc: 'TIME TRACKER. Tracks the shadow or darkness level. Activates night-only abilities.' },
        'player-hand': { title: 'Active Hand', desc: 'YOUR DECK. These are the cards currently available for you to play.' },
        'inactive-hand': { title: 'Opponent Hand', desc: 'QUANTITY. This shows how many cards the opponent is currently holding.' }
    };

    btnHelp.addEventListener('click', () => {
        helpActive = !helpActive;
        btnHelp.classList.toggle('active', helpActive);
        helpWindow.classList.toggle('hidden', !helpActive);
        
        if (!helpActive) {
            helpTitle.textContent = 'Quick Help';
            helpDesc.textContent = 'Hover over any area to learn more.';
        }
    });

    document.addEventListener('mouseover', (e) => {
        if (!helpActive) return;

        const target = e.target;
        let area = null;

        if (target.closest('.card--abyss')) area = 'abyss';
        else if (target.closest('.card-red')) area = 'steam-red';
        else if (target.closest('.card-gold')) area = 'steam-gold';
        else if (target.closest('.card-pink')) area = 'steam-pink';
        else if (target.closest('.card--destiny')) area = 'destiny';
        else if (target.closest('.card--landmark') || target.closest('.landmark-zone')) area = 'landmark';
        else if (target.closest('.card--creature') || target.closest('.creature-zone')) area = 'creature';
        else if (target.closest('.card--artifact')) area = 'artifact';
        else if (target.closest('.card--spark')) area = 'spark';
        else if (target.closest('.history-pile')) area = 'history';
        else if (target.closest('.future-pile')) area = 'future';
        else if (target.closest('.day-die-group')) area = 'day-die';
        else if (target.closest('.night-die-group')) area = 'night-die';
        else if (target.closest('.player-hand-container')) area = 'player-hand';
        else if (target.closest('.inactive-hand-display')) area = 'inactive-hand';

        if (area && helpData[area]) {
            helpTitle.textContent = helpData[area].title;
            helpDesc.textContent = helpData[area].desc;
        }
    });

    // --- Keywords List Logic ---
    let currentSort = 'az';

    btnKeywords.addEventListener('click', () => {
        renderKeywordsList();
        keywordsListModal.classList.remove('hidden');
    });

    closeKeywordsListBtn.addEventListener('click', () => {
        keywordsListModal.classList.add('hidden');
    });

    sortBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sortBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSort = btn.dataset.sort;
            renderKeywordsList();
        });
    });

    keywordSearch.addEventListener('input', () => {
        renderKeywordsList();
    });

    function renderKeywordsList() {
        const query = keywordSearch.value.toLowerCase();
        keywordsListContainer.innerHTML = '';

        let keys = Object.keys(keywordsMap).filter(k => 
            k.toLowerCase().includes(query) || 
            keywordsMap[k].desc.toLowerCase().includes(query)
        );

        let firstKey = null;

        if (currentSort === 'az') {
            keys.sort().forEach((key, index) => {
                if (index === 0) firstKey = key;
                keywordsListContainer.appendChild(createKeywordItem(key));
            });
        } else {
            // Sort by Category
            const categories = {};
            keys.forEach(key => {
                const cat = keywordsMap[key].cat || 'General';
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(key);
            });

            const sortedCats = Object.keys(categories).sort();
            sortedCats.forEach((cat, catIdx) => {
                const catTitle = document.createElement('h3');
                catTitle.className = 'category-title';
                catTitle.textContent = cat;
                keywordsListContainer.appendChild(catTitle);

                categories[cat].sort().forEach((key, keyIdx) => {
                    if (catIdx === 0 && keyIdx === 0) firstKey = key;
                    keywordsListContainer.appendChild(createKeywordItem(key));
                });
            });
        }

        // Show first keyword by default if nothing selected and search result exists
        if (firstKey) {
            showKeywordDetail(firstKey);
        } else {
            document.getElementById('display-keyword-title').textContent = 'No results';
            document.getElementById('display-keyword-desc').textContent = '';
            document.getElementById('keyword-meta-tags').innerHTML = '';
        }
    }

    function createKeywordItem(key) {
        const item = keywordsMap[key];
        const div = document.createElement('div');
        div.className = 'keyword-item';
        div.setAttribute('data-keyword', key);
        div.innerHTML = `<span class="keyword-name">${key}</span>`;
        
        div.addEventListener('click', () => {
            showKeywordDetail(key);
        });
        return div;
    }

    function showKeywordDetail(key) {
        const item = keywordsMap[key];
        if (!item) return;

        // Update UI
        document.getElementById('display-keyword-title').textContent = key;
        document.getElementById('display-keyword-desc').textContent = item.desc;
        
        const tags = document.getElementById('keyword-meta-tags');
        tags.innerHTML = `<span class="cat-badge">${item.cat || 'General'}</span>`;

        // Highlight active item in list
        document.querySelectorAll('.keyword-item').forEach(el => {
            el.classList.remove('active');
            if (el.getAttribute('data-keyword') === key) {
                el.classList.add('active');
            }
        });
    }

    setBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const setName = btn.dataset.set;
            if (selectedSets.includes(setName)) {
                if (selectedSets.length > 1) {
                    selectedSets = selectedSets.filter(s => s !== setName);
                    btn.classList.remove('active');
                }
            } else {
                selectedSets.push(setName);
                btn.classList.add('active');
            }
            shuffleBazaarPilesForFusion();
            renderBazaar();
        });
    });

    // Global modal closing logic (outside contents and interactive elements)
    document.addEventListener('click', (e) => {
        const isInteractive = e.target.closest('.card') || 
                            e.target.closest('.location-card-item') || 
                            e.target.closest('.menu-btn') ||
                            e.target.closest('.dice-d12') ||
                            e.target.closest('.modal-content') ||
                            e.target.closest('.card-link') ||
                            e.target.closest('.keyword-link');
        
        if (!isInteractive) {
            [cardModal, keywordModal, locationModal, optionsModal, keywordsListModal, rulesModal].forEach(m => {
                if(m) m.classList.add('hidden');
            });
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (heldCards.length > 0) {
                cancelGrab();
                return;
            }
            cardModal.classList.add('hidden');
            keywordModal.classList.add('hidden');
            locationModal.classList.add('hidden');
            optionsModal.classList.add('hidden');
            keywordsListModal.classList.add('hidden');
            rulesModal.classList.add('hidden');
            if (!databaseScreen.classList.contains('hidden')) {
                databaseScreen.classList.add('hidden');
                gameView.style.display = 'block'; // Or however we handle background
            }
        }
    });

    // --- Database Logic ---
    let isDatabasePopulated = false;

    btnDatabase.addEventListener('click', () => {
        if (!isDatabasePopulated) {
            populateDatabase();
            isDatabasePopulated = true;
        }
        databaseScreen.classList.remove('hidden');
        // Hide game view optionally
        // gameView.style.display = 'none';
    });

    closeDatabaseBtn.addEventListener('click', () => {
        databaseScreen.classList.add('hidden');
        // gameView.style.display = 'block';
    });

    function populateDatabase() {
        databaseBody.innerHTML = '';
        cardData.forEach(card => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${card.number}</td>
                <td><span class="card-link" data-number="${card.number}">${card.name}</span></td>
                <td>${card.cost || '-'}</td>
                <td>${card.rarity || '-'}</td>
                <td>${card.type || '-'}</td>
                <td>${card.set || '-'}</td>
            `;
            databaseBody.appendChild(tr);
        });

        // Add listeners to card links
        document.querySelectorAll('.card-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const num = e.target.getAttribute('data-number');
                const cData = cardData.find(c => c.number === num);
                if (cData) {
                    showCardDetails(cData);
                }
            });
        });
    }

    /**
     * TUTORIAL NOTE: Auto-Payment Logic
     * ---------------------------------
     * How it works:
     * When a card with a 'cost' is played into a player zone, the system scans the player's 
     * hand slots from left to right (s1 -> s5).
     * It looks for Steam cards (STM1, STM2, STM3) that match the cost requirements (F, G, L, A).
     * If the full cost can be satisfied, the matching cards are automatically moved to the 
     * History pile with a flying animation.
     * This ensures a predictable payment flow where the leftmost available resources are used first.
     */
    function autoPayCost(card) {
        if (!card.cost) return;
        
        const activeBoard = document.getElementById(`player-${currentPlayer}`);
        if (!activeBoard) return;

        // Atlantica-parked cards spend just like Hand cards.
        const handSlots = Array.from(activeBoard.querySelectorAll('.hand-slot, .atlantica-slot'));
        const historySlot = activeBoard.querySelector('.history-pile');
        if (!historySlot) return;

        const costChars = card.cost.split('');
        let slotsToUse = [];
        let usedSlotIndices = new Set();

        for (const char of costChars) {
            let found = false;
            for (let i = 0; i < handSlots.length; i++) {
                if (usedSlotIndices.has(i)) continue;
                const slot = handSlots[i];
                if (slot.classList.contains('slot-empty')) continue;

                const slotData = JSON.parse(slot.dataset.cardData);
                // Simple matching: F->STM1, G->STM2, L->STM3, A->Any STM
                if ((char === 'F' && slotData.number === 'STM1') ||
                    (char === 'G' && slotData.number === 'STM2') ||
                    (char === 'L' && slotData.number === 'STM3') ||
                    (char === 'A' && ['STM1', 'STM2', 'STM3'].includes(slotData.number))) {
                    
                    slotsToUse.push({ slot, data: slotData });
                    usedSlotIndices.add(i);
                    found = true;
                    break;
                }
            }
            if (!found) {
                // Could not satisfy full cost - abort auto-pay
                console.log("Could not satisfy full cost for auto-pay");
                return;
            }
        }

        // If we reach here, we found all cards
        slotsToUse.forEach((item, index) => {
            animateCardToHistory(item.slot, historySlot, item.data, index * 100);
            clearSlot(item.slot);
        });
    }

    function animateCardToHistory(sourceEl, historySlot, cardData, delay = 0) {
        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = historySlot.getBoundingClientRect();
        
        setTimeout(() => {
            const ghost = document.createElement('div');
            ghost.className = 'held-card-ghost';
            ghost.style.position = 'fixed';
            ghost.style.left = sourceRect.left + 'px';
            ghost.style.top = sourceRect.top + 'px';
            ghost.style.zIndex = '2000';
            
            const art = cardArtUrl(cardData);
            if (art) {
                ghost.style.backgroundImage = `url('${art}')`;
            } else {
                ghost.style.backgroundImage = "url('assets/card_back.png')";
            }
            
            document.body.appendChild(ghost);
            
            // Force layout
            ghost.offsetHeight;
            
            ghost.style.transition = 'all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)';
            ghost.style.left = targetRect.left + 'px';
            ghost.style.top = targetRect.top + 'px';
            ghost.style.transform = 'scale(0.5)';
            ghost.style.opacity = '0';

            setTimeout(() => {
                ghost.remove();
                
                // ADD DATA TO HISTORY PERSISTENTLY
                let deck = [];
                try {
                    deck = JSON.parse(historySlot.dataset.cardData || '[]');
                } catch(e) { deck = []; }
                deck.push(cardData);
                historySlot.dataset.cardData = JSON.stringify(deck);
                
                updateStackIndicator(historySlot);
            }, 600);
        }, delay);
    }

    // Meridia has 0 base Health/Strength/Resistance; she gains +1 for each Artifact
    // currently in her owner's History Pile. Shared by her zone badge, attack, and block math.
    function meridiaArtifactBonus(historySlot) {
        if (!historySlot || !historySlot.dataset.cardData) return 0;
        try {
            const hData = JSON.parse(historySlot.dataset.cardData);
            return Array.isArray(hData) ? hData.filter(c => c.type === 'Artifact').length : (hData.type === 'Artifact' ? 1 : 0);
        } catch(e) { return 0; }
    }

    // Meridia's Cabin (Duality L3): all of this board's Creatures gain +1 HP for each
    // qualifying Artifact — the TOP card of the History Pile if it's an Artifact (top card
    // only, so History contributes at most +1), plus each Artifact lying unoccupied in the
    // Creature Zone (a Lotus with no Creature on it, once Lotus is implemented).
    function cabinBonus(board) {
        if (!board) return 0;
        const hasCabin = Array.from(board.querySelectorAll('.landmark-zone-main .card:not(.slot-empty)')).some(s => {
            try { const d = JSON.parse(s.dataset.cardData); return d.name === "Meridia's Cabin" && !d.deactivated; } catch (e) { return false; }
        });
        if (!hasCabin) return 0;
        let n = 0;
        const top = getTopCard(board.querySelector('.history-pile'));
        if (top && top.type === 'Artifact') n++;
        board.querySelectorAll('.creature-zone-main .card:not(.slot-empty)').forEach(s => {
            try { if (JSON.parse(s.dataset.cardData).type === 'Artifact') n++; } catch (e) {}
        });
        return n;
    }

    // Meridia is dead on arrival with no Artifacts in History (0 base HP). Sacrifice her
    // straight to History the moment she's placed in the Creature Zone with 0 effective HP.
    function checkMeridiaZeroHp(slot, card) {
        if (card.name !== 'Meridia') return;
        const history = slot.closest('.player-zone').querySelector('.history-pile');
        if (meridiaArtifactBonus(history) > 0) return;
        floatValue(slot, 'Sacrificed (0 HP)', 'damage');
        setTimeout(() => {
            if (slot.classList.contains('slot-empty')) return;
            clearSlot(slot);
            finishSingleCardPlacement(history, card);
        }, 500);
    }

    function updateCreatureVisuals(slot) {
        if (!slot || slot.classList.contains('slot-empty') || !slot.dataset.cardData) return;
        try {
            const card = JSON.parse(slot.dataset.cardData);
            if (card.type !== 'Creature') return;

            slot.querySelectorAll('.creature-stat-badge, .health-badge, .str-marker, .lotus-marker').forEach(b => b.remove());

            // Face-down cards show no stats — that's the mystery.
            if (card.deactivated) return;

            // Lotus (Duality A2): mark a Creature that sits on a Lotus pad (they share fate).
            if (card.lotusPad) {
                const lm = document.createElement('div');
                lm.className = 'lotus-marker';
                lm.textContent = '🪷';
                slot.appendChild(lm);
            }

            // Calculate special buffs (e.g., Meridia, Meridia's Cabin)
            let bonus = 0;
            if (card.name === 'Meridia') {
                bonus = meridiaArtifactBonus(slot.closest('.player-zone').querySelector('.history-pile'));
            }
            bonus += cabinBonus(slot.closest('.player-zone'));
            // Meridius's +Strength is attack-only and target-dependent, so it is NOT shown on the
            // zone badge (that would misread as block strength / be ambiguous with 3+ players).
            // His buff is surfaced only in the Creature Attack screen — see decorateCombatScreen.

            // Chrona: an uneven split shows both values (⚔ Strength / ⛨ Resistance).
            if (card.name === 'Chrona' && card.baseStrength !== undefined &&
                card.baseStrength !== card.baseResistance) {
                const cStr = Math.max(0, card.baseStrength + bonus - (card.damageTaken || 0));
                const cRes = Math.max(0, card.baseResistance + bonus - (card.damageTaken || 0));
                const badge = document.createElement('div');
                badge.className = 'creature-stat-badge tech-font chrona-split';
                badge.textContent = `⚔${cStr} ⛨${cRes}`;
                if ((card.damageTaken || 0) > 0) badge.classList.add('damage');
                if (bonus > 0) badge.classList.add('buffed');
                slot.appendChild(badge);
                return;
            }

            const base = parseInt(card.baseStrength ?? card.baseHealth) || 0;
            const curStr = base + bonus - (card.damageTaken || 0);

            // Only show the badge if the strength/health has changed from the printed/base value.
            // A rescued Masiota's reduced ceiling always shows (his printed card still says 3).
            const masiotaReduced = card.name === 'Masiota' && (card.masiotaUses || 0) > 0;
            // Aromeas prints X/X/X — there's no printed number, so his entry-fixed HP must
            // ALWAYS show or the player can't read his stat.
            const aromeasFixed = card.name === 'Aromeas' && card.aromeasSet;
            if (curStr === base && bonus === 0 && (card.damageTaken || 0) === 0 && !masiotaReduced && !aromeasFixed) return;

            const badge = document.createElement('div');
            badge.className = 'creature-stat-badge tech-font';
            badge.textContent = curStr;

            if ((card.damageTaken || 0) > 0 || masiotaReduced) badge.classList.add('damage');
            if (bonus > 0) badge.classList.add('buffed');

            slot.appendChild(badge);
        } catch(e) {}
    }

    // --- Aetherlab: trade a Steam up one tier (Fire→Gold, Gold→Laser) using the Bazaar ---
    // Two ways to use it, both once per Construction Phase:
    //   Method A — click the landmark to arm it; upgradeable hand Steams glow; click one to trade up.
    //   Method B — grab a Steam from hand and drop it on its own drawer (or the next-tier drawer)
    //              in the Bazaar; it trades up automatically (no arming needed).
    // Either way the traded-in Steam returns to its own Bazaar drawer and you draw the next tier.
    // LaserSteam is already the top tier and can't be upgraded.
    const AETHERLAB_UPGRADE = {
        STM1: { fromLoc: 'ST1', toLoc: 'ST2', validDrawers: ['ST1', 'ST2'], nextName: 'GoldSteam' },  // Fire → Gold
        STM2: { fromLoc: 'ST2', toLoc: 'ST3', validDrawers: ['ST2', 'ST3'], nextName: 'LaserSteam' }, // Gold → Laser
    };

    function aetherlabReady() {
        return !devMode && currentPhase === 1 && !aetherlabUsedThisPhase
            && !!findLandmark(currentPlayer, 'Aetherlab');
    }

    function bazaarHasSteam(loc) {
        return (activeBazaar[loc] || []).filter(c => selectedSets.includes(c.set)).length > 0;
    }

    // Take the next-tier Steam out of the Bazaar and return the traded-in Steam to its drawer.
    // Returns the upgraded card, or null if it can't be done (top tier / no Bazaar stock).
    function aetherlabUpgradeCard(steamCard) {
        const spec = AETHERLAB_UPGRADE[steamCard.number];
        if (!spec || !bazaarHasSteam(spec.toLoc)) return null;
        const toPile = activeBazaar[spec.toLoc] || [];
        const upgraded = toPile.pop();
        activeBazaar[spec.toLoc] = toPile;
        if (!upgraded) return null;
        activeBazaar[spec.fromLoc] = activeBazaar[spec.fromLoc] || [];
        activeBazaar[spec.fromLoc].push({ ...steamCard });
        return { ...upgraded };
    }

    function eligibleHandSteams() {
        const board = document.getElementById(`player-${currentPlayer}`);
        if (!board) return [];
        return Array.from(board.querySelectorAll('.hand-slot:not(.slot-empty), .atlantica-slot:not(.slot-empty)')).filter(s => {
            try {
                const d = JSON.parse(s.dataset.cardData);
                const spec = AETHERLAB_UPGRADE[d.number];
                return spec && bazaarHasSteam(spec.toLoc);
            } catch (e) { return false; }
        });
    }

    function highlightAetherlabSteams() {
        clearAetherlabHighlights();
        eligibleHandSteams().forEach(s => s.classList.add('aetherlab-upgradable'));
    }

    function clearAetherlabHighlights() {
        document.querySelectorAll('.aetherlab-upgradable').forEach(s => s.classList.remove('aetherlab-upgradable'));
    }

    function toggleAetherlab() {
        if (aetherlabUsedThisPhase) {
            alert('Aetherlab can only trade once per Construction Phase.');
            return;
        }
        aetherlabActive = !aetherlabActive;
        pulseLandmark(currentPlayer, 'Aetherlab');
        if (aetherlabActive) {
            const eligible = eligibleHandSteams();
            if (eligible.length === 0) {
                aetherlabActive = false;
                alert('No Steam to upgrade. You need a FireSteam or GoldSteam in hand and the next tier available in the Bazaar.');
                return;
            }
            highlightAetherlabSteams();
        } else {
            clearAetherlabHighlights();
        }
    }

    function deactivateAetherlab() {
        aetherlabActive = false;
        clearAetherlabHighlights();
    }

    // Book-keeping shared by both trade paths.
    function finishAetherlabTrade() {
        aetherlabUsedThisPhase = true;
        aetherlabActive = false;
        clearAetherlabHighlights();
        pulseLandmark(currentPlayer, 'Aetherlab');
        renderBazaar();
        updateBazaarLighting();
    }

    // Method A: upgrade the Steam sitting in a given hand slot, in place.
    function tryAetherlabUpgradeHandSlot(slot) {
        let card;
        try { card = JSON.parse(slot.dataset.cardData); } catch (e) { return false; }
        const spec = AETHERLAB_UPGRADE[card.number];
        if (!spec) return false;
        const upgraded = aetherlabUpgradeCard(card);
        if (!upgraded) {
            alert(`No ${spec.nextName} left in the Bazaar to trade for.`);
            return false;
        }
        clearSlot(slot);
        finishSingleCardPlacement(slot, upgraded);
        floatValue(slot, `▲ ${upgraded.name}`, 'gain');
        finishAetherlabTrade();
        return true;
    }

    // Method B: a held Steam was dropped on a Bazaar steam drawer. Upgrade if the drawer is the
    // Steam's own tier or the next tier up, and the next tier is in stock.
    function tryAetherlabDrop(drawerEl) {
        if (!aetherlabReady()) return false;
        const held = heldCards[0];
        if (!held || held.type !== 'Steam') return false;
        const spec = AETHERLAB_UPGRADE[held.number];
        if (!spec || !spec.validDrawers.includes(drawerEl.dataset.loc)) return false;
        const upgraded = aetherlabUpgradeCard(held);
        if (!upgraded) return false;

        // Consume the held Steam (its source hand slot was already cleared on grab) and
        // drop the upgraded tier into the first free hand slot.
        heldCards.shift();
        heldCardSources.shift();
        const board = document.getElementById(`player-${currentPlayer}`);
        const emptySlot = Array.from(board.querySelectorAll('.hand-slot.slot-empty'))[0];
        if (emptySlot) {
            finishSingleCardPlacement(emptySlot, upgraded);
            floatValue(emptySlot, `▲ ${upgraded.name}`, 'gain');
        }

        // Clear the held-card UI state.
        if (heldGhost) heldGhost.remove();
        heldGhost = null;
        document.onmousemove = null;
        document.querySelectorAll('.hand-auto-drop').forEach(btn => btn.classList.add('hidden'));
        clearHighlights();
        finishAetherlabTrade();
        return true;
    }

    function showAttackMenu(attackerCard, attackerSlot) {
        currentAttackerCard = attackerCard;
        currentAttackerSlot = attackerSlot;
        document.getElementById('attack-action-menu').classList.remove('hidden');
    }

    function executeAttack() {
        document.getElementById('attack-action-menu').classList.add('hidden');
        if (currentAttackerCard && currentAttackerSlot) {
            triggerAttack(currentAttackerCard, currentAttackerSlot);
        }
    }

    function cancelAttack() {
        document.getElementById('attack-action-menu').classList.add('hidden');
        currentAttackerCard = null;
        currentAttackerSlot = null;
    }

    function triggerAttack(attackerCard, attackerSlot) {
        // Looper (C3): his attack opens with a Futory-die roll — that many strikes in a row.
        if (attackerCard.name === 'Looper' && looperStrikesRemaining === 0 && !aiTurnInProgress) {
            rollLooperDie(attackerCard, attackerSlot);
            return;
        }
        // Looper strikes 2+ are plain: printed Strength only, no Artifact responses,
        // no Hyperscope targeting — "any additional effects only apply to the first attack".
        const looperPlain = attackerCard.name === 'Looper' && looperFirstStrikeResolved;
        const attacker = looperPlain ? { ...attackerCard, looperPlainStrike: true } : attackerCard;

        // Namandi (C7): before he attacks you may discard any number of Non-Steam cards from
        // your Hand (Atlantica-parked cards count) to History; each gives +1 Strength for THIS
        // attack only. The chooser reopens the attack via a boosted copy (namandiResolved), so
        // the +Strength threads through the same pipeline as Meridius. The Computer skips it (V1).
        if (attacker.name === 'Namandi' && !aiTurnInProgress && !attacker.namandiResolved) {
            promptNamandiDiscard(attacker, attackerSlot);
            return;
        }

        // Hyperscope (L7): the attack gains a targeting step — any Player, Creature, or
        // Landmark, all resolved without a block choice (Simon's ruling). The Computer
        // keeps the plain attack flow for now (V1: it doesn't aim at cards).
        if (!aiTurnInProgress && !looperPlain && findLandmark(currentPlayer, 'Hyperscope')) {
            promptHyperscopeTarget(attacker, attackerSlot);
            return;
        }
        if (activePlayerCount === 2) {
            const defender = currentPlayer === 1 ? 2 : 1;
            beginAttack(attacker, attackerSlot, defender);
        } else {
            const overlay = document.getElementById('target-player-overlay');
            const list = document.getElementById('target-player-list');
            list.innerHTML = '';

            for (let i = 1; i <= activePlayerCount; i++) {
                if (i === currentPlayer) continue;
                const circle = document.createElement('div');
                circle.className = `target-circle p${i}`;
                circle.textContent = `P${i}`;
                circle.onclick = () => {
                    overlay.classList.add('hidden');
                    beginAttack(attacker, attackerSlot, i);
                };
                list.appendChild(circle);
            }
            overlay.classList.remove('hidden');
        }
    }

    // --- Namandi (Duality C7): discard Non-Steam cards for +Strength on this attack ---
    // Tentative multi-select: eligible hand/parked cards pulse red; clicking toggles a gold
    // selection; the running Strength updates live. ATTACK spends the selected cards to History
    // (each +1 Strength) and resumes the attack with the boosted copy; CANCEL aborts the whole
    // attack with nothing discarded. If nothing is eligible, we skip straight to the attack.
    function promptNamandiDiscard(attacker, attackerSlot) {
        const board = document.getElementById(`player-${currentPlayer}`);
        const baseStr = parseInt(attacker.baseStrength ?? attacker.baseHealth) || 0;
        const eligible = Array.from(board.querySelectorAll('.hand-slot:not(.slot-empty), .atlantica-slot:not(.slot-empty)'))
            .filter(s => {
                try { return JSON.parse(s.dataset.cardData).type !== 'Steam'; } catch (e) { return false; }
            });

        const resume = (bonus) => {
            if (bonus > 0) floatValue(attackerSlot, `+${bonus} Strength`, 'gain');
            triggerAttack({ ...attacker, baseStrength: baseStr + bonus, namandiResolved: true }, attackerSlot);
        };

        if (!eligible.length) { resume(0); return; }

        const selected = new Set();

        const bar = document.createElement('div');
        bar.id = 'namandi-bar';
        bar.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:6000;align-items:center;';
        const hint = document.createElement('div');
        hint.className = 'menu-btn tech-font';
        hint.style.cssText = 'pointer-events:none;opacity:0.9;';
        const updateHint = () => { hint.textContent = `DISCARD NON-STEAM FOR +1 STRENGTH · Strength ${baseStr + selected.size}`; };
        updateHint();
        bar.appendChild(hint);
        const attackBtn = document.createElement('button');
        attackBtn.className = 'menu-btn';
        attackBtn.textContent = 'ATTACK';
        bar.appendChild(attackBtn);
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'menu-btn secondary-btn';
        cancelBtn.textContent = 'CANCEL';
        bar.appendChild(cancelBtn);
        document.body.appendChild(bar);

        const cleanup = () => {
            eligible.forEach(s => {
                s.classList.remove('threat-target', 'namandi-selected');
                if (s._namandiHandler) s.removeEventListener('click', s._namandiHandler, true);
                delete s._namandiHandler;
            });
            bar.remove();
        };

        cancelBtn.onclick = cleanup; // abort the attack; nothing discarded

        attackBtn.onclick = () => {
            const historyEl = board.querySelector('.history-pile');
            selected.forEach(s => {
                let data; try { data = JSON.parse(s.dataset.cardData); } catch (e) { return; }
                clearSlot(s);
                finishSingleCardPlacement(historyEl, data);
            });
            const bonus = selected.size;
            cleanup();
            if (bonus > 0) updateHandLayout(currentPlayer);
            resume(bonus);
        };

        eligible.forEach(s => {
            s.classList.add('threat-target');
            const handler = (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (selected.has(s)) { selected.delete(s); s.classList.remove('namandi-selected'); }
                else { selected.add(s); s.classList.add('namandi-selected'); }
                updateHint();
            };
            s._namandiHandler = handler;
            s.addEventListener('click', handler, true); // capture: preempt the normal grab
        });
    }

    // --- Looper (Duality C3): attack multiple times by rolling a Futory Die ---
    // The roll sets the number of strikes. Clone Factory style: Looper stays in his zone
    // between strikes, the target is re-picked each time, and he goes to History only after
    // the final strike. The defender may block every strike separately, but additional
    // effects (Artifacts, buffs, Hyperscope) only apply to the FIRST one — later strikes
    // hit with plain printed Strength.
    let looperStrikesRemaining = 0;
    let looperFirstStrikeResolved = false;
    let looperPendingSlot = null;

    function resetLooper() {
        looperStrikesRemaining = 0;
        looperFirstStrikeResolved = false;
        looperPendingSlot = null;
    }

    function rollLooperDie(attackerCard, attackerSlot) {
        const result = 1 + Math.floor(Math.random() * 6);

        const overlay = document.createElement('div');
        overlay.className = 'overlay entrophy-overlay';
        const panel = document.createElement('div');
        panel.className = 'glass-panel entrophy-panel';
        panel.innerHTML = `<h2 class="fantasy-font glowing-text entrophy-title">LOOPER</h2>
            <p class="tech-font entrophy-subtitle">Rolling the Futory Die&hellip;</p>`;
        const dieWrap = document.createElement('div');
        dieWrap.style.cssText = 'display:flex;justify-content:center;margin:14px 0;transform:scale(2);';
        panel.appendChild(dieWrap);
        const footer = document.createElement('div');
        footer.className = 'entrophy-footer';
        panel.appendChild(footer);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        const showFace = (n) => { dieWrap.innerHTML = ''; dieWrap.appendChild(buildPips(n)); };

        // Cycle the faces fast → slowing, then land on the result (Entrophy's ease-out).
        const minSteps = 18;
        let step = 0;
        let face = 1;
        function tick() {
            showFace(face);
            if (step >= minSteps && face === result) { land(); return; }
            face = (face % 6) + 1;
            step++;
            const progress = Math.min(1, step / (minSteps + 6));
            setTimeout(tick, 45 + Math.pow(progress, 3) * 300);
        }

        function land() {
            panel.querySelector('.entrophy-subtitle').innerHTML =
                `<span class="entrophy-result">${result} Attack${result === 1 ? '' : 's'}!</span>` +
                (result > 1 ? ' &mdash; only the first carries additional effects' : '');
            const btn = document.createElement('button');
            btn.className = 'menu-btn combat-btn';
            btn.textContent = 'ATTACK';
            btn.onclick = () => {
                overlay.remove();
                looperStrikesRemaining = result;
                looperFirstStrikeResolved = false;
                triggerAttack(attackerCard, attackerSlot);
            };
            footer.appendChild(btn);
        }

        tick();
    }

    // After a strike's result overlay closes, re-open the attack flow if Looper has
    // strikes left (the Clone Factory maybeCloneSecondStrike pattern).
    function maybeLooperNextStrike() {
        if (!looperPendingSlot || looperStrikesRemaining < 1) return;
        const slot = looperPendingSlot;
        looperPendingSlot = null;
        if (slot.classList.contains('slot-empty') || !slot.dataset.cardData) { resetLooper(); return; }
        let data;
        try { data = JSON.parse(slot.dataset.cardData); } catch (e) { resetLooper(); return; }
        setTimeout(() => triggerAttack(data, slot), 150);
    }

    // --- Hyperscope (Duality L7): target any Player, Creature, or Landmark directly ---
    // While Hyperscope is in play, attacking opens a targeting step: every face-up enemy
    // Creature and Landmark pulses as a clickable target (the Threat picker pattern), and a
    // docked bar offers the direct player strike or a cancel. Whatever is picked, the attack
    // resolves with NO block choice for the defender — Artifact responses (Smoke, Reflector)
    // stay legal on the defense screen. Landmark damage accumulates per turn toward the
    // Landmark's Price (its total Steam pip count, color-blind: GGGL = 4).
    function promptHyperscopeTarget(attackerCard, attackerSlot) {
        const targets = [];
        for (let p = 1; p <= activePlayerCount; p++) {
            if (p === currentPlayer) continue;
            const board = document.getElementById(`player-${p}`);
            if (!board) continue;
            board.querySelectorAll('.creature-zone-main .card:not(.slot-empty)').forEach(slot => {
                try {
                    const d = JSON.parse(slot.dataset.cardData);
                    if (d.type === 'Creature' && !d.deactivated) targets.push({ slot, owner: p, kind: 'creature' });
                } catch (e) { /* skip */ }
            });
            board.querySelectorAll('.landmark-zone-main .card:not(.slot-empty)').forEach(slot => {
                try {
                    const d = JSON.parse(slot.dataset.cardData);
                    if (d.type === 'Landmark' && !d.deactivated) targets.push({ slot, owner: p, kind: 'landmark' });
                } catch (e) { /* skip */ }
            });
        }

        const bar = document.createElement('div');
        bar.id = 'hyperscope-target-bar';
        bar.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:6000;';

        const cleanup = () => {
            targets.forEach(t => {
                t.slot.classList.remove('threat-target');
                if (t.slot._hyperHandler) t.slot.removeEventListener('click', t.slot._hyperHandler, true);
                delete t.slot._hyperHandler;
            });
            bar.remove();
        };

        targets.forEach(t => {
            t.slot.classList.add('threat-target');
            const handler = (e) => {
                e.stopPropagation();
                e.preventDefault();
                cleanup();
                beginAttack(attackerCard, attackerSlot, t.owner, { kind: t.kind, slot: t.slot });
            };
            t.slot._hyperHandler = handler;
            t.slot.addEventListener('click', handler, true); // capture: preempt the normal card click
        });

        for (let p = 1; p <= activePlayerCount; p++) {
            if (p === currentPlayer) continue;
            const btn = document.createElement('button');
            btn.className = 'menu-btn combat-btn';
            btn.textContent = activePlayerCount === 2 ? 'STRIKE PLAYER DIRECTLY' : `STRIKE P${p} DIRECTLY`;
            btn.onclick = () => {
                cleanup();
                beginAttack(attackerCard, attackerSlot, p, { kind: 'player' });
            };
            bar.appendChild(btn);
        }
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'menu-btn secondary-btn';
        cancelBtn.textContent = 'CANCEL';
        cancelBtn.onclick = cleanup;
        bar.appendChild(cancelBtn);
        document.body.appendChild(bar);

        pulseLandmark(currentPlayer, 'Hyperscope');
    }

    // A Landmark's Price is its total Steam pip count, regardless of color (GGGL = 4).
    function landmarkPrice(card) {
        return (card.cost && card.cost !== '-') ? card.cost.length : 0;
    }

    // A Hyperscope strike on a Landmark: the attack's damage accumulates on the Landmark
    // for the rest of this turn (badge shows progress); reaching its Price destroys it —
    // to its OWNER'S HISTORY (Duality rule: destroyed Landmarks cycle, and rebuild
    // themselves when drawn — see drawCards). The attacker still goes to History too.
    function resolveLandmarkStrike(attacker, attackerSlot, targetSlot, defenderNum) {
        const feedbackEl = document.getElementById('combat-feedback');
        feedbackEl.classList.add('combat-feedback-vital');

        let target;
        try { target = JSON.parse(targetSlot.dataset.cardData); } catch (e) { return; }
        const str = calculateCurrentStrength(attacker, attackerSlot);
        const price = landmarkPrice(target);
        target.hyperDamage = (target.hyperDamage || 0) + str;
        const attackerHistory = attackerSlot.closest('.player-zone').querySelector('.history-pile');

        if (price > 0 && target.hyperDamage >= price) {
            feedbackEl.textContent = `${target.name} Destroyed! (${target.hyperDamage}/${price})`;
            delete target.hyperDamage; // don't carry turn damage into the History cycle
            const ownerHistory = targetSlot.closest('.player-zone').querySelector('.history-pile');
            clearSlot(targetSlot);
            finishSingleCardPlacement(ownerHistory, target);
            floatValue(ownerHistory, `${target.name} Destroyed`, 'damage');
        } else {
            targetSlot.dataset.cardData = JSON.stringify(target);
            feedbackEl.textContent = `${target.name} Struck — ${target.hyperDamage}/${price} this turn.`;
            updateHyperDamageBadge(targetSlot, target);
            floatValue(targetSlot, `-${str}`, 'damage');
        }
        finishAttacker(attackerSlot, attacker, attackerHistory);
    }

    function updateHyperDamageBadge(slot, card) {
        let badge = slot.querySelector('.hyper-damage-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'hyper-damage-badge tech-font';
            slot.appendChild(badge);
        }
        badge.textContent = `⌖ ${card.hyperDamage}/${landmarkPrice(card)}`;
    }

    // "The attacks in one turn" — accumulated Landmark damage expires when the turn passes.
    function resetHyperscopeTurnDamage() {
        document.querySelectorAll('.landmark-zone-main .card:not(.slot-empty)').forEach(slot => {
            const badge = slot.querySelector('.hyper-damage-badge');
            if (badge) badge.remove();
            try {
                const d = JSON.parse(slot.dataset.cardData);
                if (d.hyperDamage) { delete d.hyperDamage; slot.dataset.cardData = JSON.stringify(d); }
            } catch (e) { /* skip */ }
        });
    }

    // --- Mines of Pyralos (Duality L8) ---
    // "Once per Construction Phase: You may send 1 of your Cards into the Abyss to look at
    // the top 6 Cards in any Future Pile and rearrange them. Then, draw a Card."
    // Flow: click the Mines → pick the card to pay (hand + Atlantica-parked cards pulse;
    // CANCEL is only offered before paying) → pick a Future Pile (auto if only one is
    // non-empty) → rearrange its top 6 in an overlay (leftmost = drawn next) → draw 1.
    let minesUsedThisPhase = false;

    function activateMines() {
        if (minesUsedThisPhase) {
            alert('Mines of Pyralos — already used this Construction Phase.');
            return;
        }
        const board = document.getElementById(`player-${currentPlayer}`);
        const costSlots = Array.from(board.querySelectorAll('.hand-slot:not(.slot-empty), .atlantica-slot:not(.slot-empty)'));
        if (!costSlots.length) {
            alert('Mines of Pyralos — no card in hand to send into the Abyss.');
            return;
        }
        promptMinesCost(costSlots);
    }

    // Step 1 — choose which of your cards is sent into the Abyss (gone for good).
    function promptMinesCost(costSlots) {
        const bar = document.createElement('div');
        bar.id = 'mines-cost-bar';
        bar.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:6000;';
        const hint = document.createElement('div');
        hint.className = 'menu-btn tech-font';
        hint.style.cssText = 'pointer-events:none;opacity:0.85;';
        hint.textContent = 'SEND A CARD INTO THE ABYSS';
        bar.appendChild(hint);
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'menu-btn secondary-btn';
        cancelBtn.textContent = 'CANCEL';
        bar.appendChild(cancelBtn);
        document.body.appendChild(bar);

        const cleanup = () => {
            costSlots.forEach(s => {
                s.classList.remove('threat-target');
                if (s._minesHandler) s.removeEventListener('click', s._minesHandler, true);
                delete s._minesHandler;
            });
            bar.remove();
        };
        cancelBtn.onclick = cleanup;

        costSlots.forEach(s => {
            s.classList.add('threat-target');
            const handler = (e) => {
                e.stopPropagation();
                e.preventDefault();
                let data;
                try { data = JSON.parse(s.dataset.cardData); } catch (err) { return; }
                cleanup();
                const abyssEl = document.querySelector('.card--abyss');
                clearSlot(s);
                finishSingleCardPlacement(abyssEl, data);
                floatValue(abyssEl, `${data.name} Lost`, 'damage');
                updateHandLayout(currentPlayer);
                minesUsedThisPhase = true;
                pulseLandmark(currentPlayer, 'Mines of Pyralos');
                promptMinesPile();
            };
            s._minesHandler = handler;
            s.addEventListener('click', handler, true); // capture: preempt the normal grab
        });
    }

    // Step 2 — choose ANY Future Pile (yours or an opponent's). Auto-resolves when only
    // one pile has cards; if every pile is empty there is nothing to look at — just draw.
    function promptMinesPile() {
        const piles = [];
        for (let p = 1; p <= activePlayerCount; p++) {
            const board = document.getElementById(`player-${p}`);
            if (!board) continue;
            const pile = board.querySelector('.future-pile');
            if (!pile) continue;
            let count = 0;
            try { const d = JSON.parse(pile.dataset.cardData || '[]'); count = Array.isArray(d) ? d.length : 1; } catch (e) {}
            if (count > 0) piles.push({ slot: pile, owner: p });
        }
        if (piles.length === 0) { drawCards(currentPlayer, 1); return; }
        if (piles.length === 1) { openMinesRearrange(piles[0]); return; }

        const cleanup = () => piles.forEach(t => {
            t.slot.classList.remove('threat-target');
            if (t.slot._minesHandler) t.slot.removeEventListener('click', t.slot._minesHandler, true);
            delete t.slot._minesHandler;
        });
        piles.forEach(t => {
            t.slot.classList.add('threat-target');
            const handler = (e) => {
                e.stopPropagation();
                e.preventDefault();
                cleanup();
                openMinesRearrange(t);
            };
            t.slot._minesHandler = handler;
            t.slot.addEventListener('click', handler, true);
        });
    }

    // Step 3 — look at the pile's top 6 and rearrange them. Leftmost = drawn next; each
    // card moves with its ◀ ▶ arrows. Confirming writes the order back, then draws 1.
    function openMinesRearrange(target) {
        const { slot: pileSlot, owner } = target;
        let deck = [];
        try { deck = JSON.parse(pileSlot.dataset.cardData || '[]'); if (!Array.isArray(deck)) deck = [deck]; } catch (e) {}
        const lookCount = Math.min(6, deck.length);
        // Top of the pile is the END of the array (draws pop from the end); display top-first.
        const order = deck.slice(-lookCount).reverse();

        const overlay = document.createElement('div');
        overlay.className = 'overlay landmark-choice-overlay';
        const panel = document.createElement('div');
        panel.className = 'glass-panel landmark-choice-panel';
        panel.style.maxWidth = 'none';
        const title = document.createElement('div');
        title.className = 'fantasy-font glowing-text landmark-choice-title';
        title.textContent = `Mines of Pyralos — P${owner}'s Future Pile`;
        panel.appendChild(title);
        const desc = document.createElement('div');
        desc.className = 'tech-font';
        desc.style.cssText = 'font-size:11px;opacity:0.75;margin:-6px 0 8px;';
        desc.textContent = `Top ${lookCount} card${lookCount === 1 ? '' : 's'} — leftmost is drawn next. Rearrange with the arrows.`;
        panel.appendChild(desc);

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:10px;';
        panel.appendChild(row);

        function renderRow() {
            row.innerHTML = '';
            order.forEach((card, i) => {
                const tile = document.createElement('div');
                tile.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;';
                const face = document.createElement('div');
                face.style.cssText = 'width:80px;height:112px;border-radius:6px;background-size:cover;background-position:center;border:1px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;text-align:center;font-size:10px;';
                const art = cardArtUrl(card);
                if (art) face.style.backgroundImage = `url('${art}')`;
                else { face.style.backgroundColor = 'rgba(255,255,255,0.1)'; face.textContent = card.name; }
                tile.appendChild(face);
                const name = document.createElement('div');
                name.className = 'tech-font';
                name.style.cssText = 'font-size:9px;opacity:0.8;max-width:84px;text-align:center;';
                name.textContent = card.name;
                tile.appendChild(name);
                const arrows = document.createElement('div');
                arrows.style.cssText = 'display:flex;gap:4px;';
                const mk = (txt, delta) => {
                    const b = document.createElement('button');
                    b.className = 'menu-btn secondary-btn';
                    b.style.cssText = 'padding:2px 8px;font-size:10px;min-width:0;';
                    b.textContent = txt;
                    b.disabled = (i + delta < 0 || i + delta >= order.length);
                    b.style.opacity = b.disabled ? '0.4' : '1';
                    b.onclick = () => {
                        [order[i], order[i + delta]] = [order[i + delta], order[i]];
                        renderRow();
                    };
                    return b;
                };
                arrows.appendChild(mk('◀', -1));
                arrows.appendChild(mk('▶', 1));
                tile.appendChild(arrows);
                row.appendChild(tile);
            });
        }
        renderRow();

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'menu-btn combat-btn tech-font';
        confirmBtn.textContent = 'CONFIRM ORDER & DRAW';
        confirmBtn.onclick = () => {
            const newDeck = deck.slice(0, deck.length - lookCount).concat(order.slice().reverse());
            pileSlot.dataset.cardData = JSON.stringify(newDeck);
            updateStackIndicator(pileSlot);
            overlay.remove();
            drawCards(currentPlayer, 1);
        };
        panel.appendChild(confirmBtn);

        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    }

    // Dark Matter (A2): Construction Phase — discard it to your History, draw a card, then a
    // chosen player must pick one of three costs. In 2-player V1 the opponent is automatic;
    // with more players, reuse the same target-player-overlay the attack flow uses.
    async function triggerDarkMatter(cardData, slot) {
        const board = slot.closest('.player-zone');
        const historySlot = board.querySelector('.history-pile');
        clearSlot(slot);
        finishSingleCardPlacement(historySlot, cardData);

        await drawCards(currentPlayer, 1);

        if (activePlayerCount === 2) {
            const target = currentPlayer === 1 ? 2 : 1;
            showDarkMatterChoice(target);
        } else {
            const overlay = document.getElementById('target-player-overlay');
            const list = document.getElementById('target-player-list');
            list.innerHTML = '';
            for (let i = 1; i <= activePlayerCount; i++) {
                if (i === currentPlayer) continue;
                const circle = document.createElement('div');
                circle.className = `target-circle p${i}`;
                circle.textContent = `P${i}`;
                circle.onclick = () => {
                    overlay.classList.add('hidden');
                    showDarkMatterChoice(i);
                };
                list.appendChild(circle);
            }
            overlay.classList.remove('hidden');
        }
    }

    // Present the three Dark Matter costs to the targeted player. Each option auto-resolves
    // when there is only one legal instance (one Creature, one hand card); otherwise the
    // player picks which one, mirroring the blocker-picker used in the Creature Attack screen.
    function showDarkMatterChoice(defenderNum) {
        const defenderBoard = document.getElementById(`player-${defenderNum}`);
        const overlay = document.getElementById('darkmatter-overlay');
        const preview = document.getElementById('darkmatter-preview');
        const target = document.getElementById('darkmatter-target');
        const feedbackEl = document.getElementById('darkmatter-feedback');
        const btnSac = document.getElementById('btn-dm-sacrifice');
        const btnDisc = document.getElementById('btn-dm-discard');
        const btnTp = document.getElementById('btn-dm-losetp');

        preview.style.backgroundImage = "url('assets/cards/dark_matter.png')";
        preview.textContent = '';
        target.style.backgroundImage = '';
        target.classList.remove('faded', 'active-blocker');
        target.textContent = `P${defenderNum}`;

        const existingPicker = document.getElementById('dm-picker');
        if (existingPicker) existingPicker.remove();
        feedbackEl.textContent = "Choose ONE:";

        const creatures = Array.from(defenderBoard.querySelectorAll('.creature-zone-main .card:not(.slot-empty)'));
        const handCards = Array.from(defenderBoard.querySelectorAll('.hand-slot:not(.slot-empty)'));

        [btnSac, btnDisc, btnTp].forEach(b => { b.classList.remove('in-use'); b.style.opacity = '1'; });
        btnSac.disabled = creatures.length === 0;
        btnSac.style.opacity = btnSac.disabled ? '0.5' : '1';
        btnDisc.disabled = handCards.length === 0;
        btnDisc.style.opacity = btnDisc.disabled ? '0.5' : '1';
        btnTp.disabled = false;

        let resolved = false;
        const finish = (msg) => {
            if (resolved) return;
            resolved = true;
            btnSac.disabled = btnDisc.disabled = btnTp.disabled = true;
            feedbackEl.textContent = msg;
            setTimeout(() => overlay.classList.add('hidden'), 900);
        };

        function showPicker(items, labelFn, onPick) {
            const picker = document.createElement('div');
            picker.id = 'dm-picker';
            picker.style.cssText = 'margin-top:10px;text-align:center;';
            picker.innerHTML = '<p class="tech-font" style="font-size:10px;opacity:0.7;margin-bottom:6px;">SELECT ONE:</p>';
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center;';
            items.forEach((item) => {
                const btn = document.createElement('button');
                btn.className = 'menu-btn secondary-btn';
                btn.style.cssText = 'padding:4px 8px;font-size:10px;min-width:80px;';
                btn.textContent = labelFn(item);
                btn.onclick = (ev) => { ev.stopPropagation(); onPick(item); };
                row.appendChild(btn);
            });
            picker.appendChild(row);
            document.querySelector('#darkmatter-overlay .combat-modal').appendChild(picker);
        }

        function sacrificeCreature(cSlot) {
            const cData = JSON.parse(cSlot.dataset.cardData);
            const hist = defenderBoard.querySelector('.history-pile');
            if (maybeMasiotaRescue(cSlot, cData)) { finish('Masiota Deactivated.'); return; }
            floatValue(cSlot, 'Sacrificed', 'damage');
            clearSlot(cSlot);
            finishSingleCardPlacement(hist, cData);
            finish(`${cData.name} Sacrificed.`);
        }

        function discardHandCard(hSlot) {
            const hData = JSON.parse(hSlot.dataset.cardData);
            const hist = defenderBoard.querySelector('.history-pile');
            floatValue(hSlot, 'Discarded', 'damage');
            clearSlot(hSlot);
            finishSingleCardPlacement(hist, hData);
            finish(`${hData.name} Discarded.`);
        }

        btnSac.onclick = () => {
            if (resolved || creatures.length === 0) return;
            const pickerEl = document.getElementById('dm-picker');
            if (pickerEl) pickerEl.remove();
            if (creatures.length === 1) {
                sacrificeCreature(creatures[0]);
            } else {
                showPicker(creatures, (s) => JSON.parse(s.dataset.cardData).name, sacrificeCreature);
            }
        };

        btnDisc.onclick = () => {
            if (resolved || handCards.length === 0) return;
            const pickerEl = document.getElementById('dm-picker');
            if (pickerEl) pickerEl.remove();
            if (handCards.length === 1) {
                discardHandCard(handCards[0]);
            } else {
                showPicker(handCards, (s) => JSON.parse(s.dataset.cardData).name, discardHandCard);
            }
        };

        btnTp.onclick = () => {
            if (resolved) return;
            resolveDamageDirectly(2, defenderNum);
            const dieSel = activeDieSel(defenderNum);
            floatValue(defenderBoard.querySelector(dieSel), '-2 TP', 'damage');
            finish('Lost 2 Time Points.');
        };

        overlay.classList.remove('hidden');

        // Dark Matter aimed at the Computer: it picks its own poison.
        if (vsComputer && defenderNum === AI_PLAYER) {
            aiHandleDarkMatter({ overlay, btnSac, btnDisc, btnTp, creatures, handCards, feedbackEl });
        }
    }

    // The defender is now chosen. Most creatures go straight to the defense step; Entrophy first
    // rolls its die (the casino wheel), and Meridius scales off the defender's Landmarks.
    function beginAttack(attacker, attackerSlot, defenderNum, hyperTarget = null) {
        if (attacker.name.includes('Entrophy')) {
            rollEntrophy(attacker, attackerSlot, defenderNum, hyperTarget);
        } else if (attacker.name.includes('Meridius')) {
            initiateDefense(meridiusAttacker(attacker, defenderNum), attackerSlot, defenderNum, hyperTarget);
        } else {
            initiateDefense(attacker, attackerSlot, defenderNum, hyperTarget);
        }
    }

    // How many Landmarks a player has in play.
    function countLandmarks(pNum) {
        const board = document.getElementById(`player-${pNum}`);
        return board ? board.querySelectorAll('.landmark-zone-main .card:not(.slot-empty)').length : 0;
    }

    // Meridius: +1 Strength per Landmark the defender owns; unblockable at 3+ (his base is 2).
    function meridiusAttacker(base, defenderNum) {
        const bonus = countLandmarks(defenderNum);
        const a = { ...base };
        a.baseStrength = (parseInt(a.baseStrength ?? a.baseHealth) || 0) + bonus;
        if (bonus >= 3) a.unblockable = true;
        return a;
    }

    // --- Entrophy: roll a die on attack; the outcome sits on top of its base Strength 2 ---
    // Instead of a physical die we spin a 6-tile wheel (fast → slowing → stops), casino-style,
    // laying out the same six faces as the card. Grid order below is row-major so the two columns
    // match the card: [none|unblock] / [str3|tp4] / [hand|self].
    const ENTROPHY_OUTCOMES = [
        { id: 'none',    pips: 1, label: 'No Additional Effect', sub: 'Attacks with 2' },
        { id: 'unblock', pips: 4, label: 'Unblockable',          sub: 'Attacks with 2' },
        { id: 'str3',    pips: 2, label: '+3 Strength',          sub: 'Attacks with 5' },
        { id: 'tp4',     pips: 5, label: '+4 Time Points',       sub: 'You gain 4 TP' },
        { id: 'hand',    pips: 3, label: "To Opponent's Hand",   sub: 'No attack' },
        { id: 'self',    pips: 6, label: 'Attacks You',          sub: '2 damage to you' },
    ];

    // Standard die pip positions on a 3×3 grid (cell indices 0–8).
    const DIE_PIPS = {
        1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
    };
    function buildPips(n) {
        const face = document.createElement('div');
        face.className = 'entrophy-die-face';
        const on = new Set(DIE_PIPS[n] || []);
        for (let i = 0; i < 9; i++) {
            const cell = document.createElement('span');
            if (on.has(i)) cell.className = 'pip';
            face.appendChild(cell);
        }
        return face;
    }

    function rollEntrophy(attacker, attackerSlot, defenderNum, hyperTarget = null) {
        const finalIdx = Math.floor(Math.random() * ENTROPHY_OUTCOMES.length);

        const overlay = document.createElement('div');
        overlay.className = 'overlay entrophy-overlay';
        const panel = document.createElement('div');
        panel.className = 'glass-panel entrophy-panel';
        panel.innerHTML = `<h2 class="fantasy-font glowing-text entrophy-title">ENTROPHY</h2>
            <p class="tech-font entrophy-subtitle">Rolling the die&hellip;</p>`;
        const grid = document.createElement('div');
        grid.className = 'entrophy-grid';
        const tiles = ENTROPHY_OUTCOMES.map(o => {
            const tile = document.createElement('div');
            tile.className = 'entrophy-tile';
            tile.appendChild(buildPips(o.pips));
            const txt = document.createElement('div');
            txt.className = 'entrophy-tile-text';
            txt.innerHTML = `<div class="entrophy-tile-label tech-font">${o.label}</div>
                <div class="entrophy-tile-sub tech-font">${o.sub}</div>`;
            tile.appendChild(txt);
            grid.appendChild(tile);
            return tile;
        });
        panel.appendChild(grid);
        const footer = document.createElement('div');
        footer.className = 'entrophy-footer';
        panel.appendChild(footer);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        const setActive = (i) => tiles.forEach((t, k) => t.classList.toggle('active', k === i));

        // Spin: cycle the highlight through every tile, fast at first then decelerating, and land
        // on finalIdx after enough steps. Deceleration is an ease-out on the step delay.
        const minSteps = 22;
        let step = 0;
        let idx = 0;
        function tick() {
            setActive(idx);
            if (step >= minSteps && idx === finalIdx) { land(); return; }
            idx = (idx + 1) % ENTROPHY_OUTCOMES.length;
            step++;
            const progress = Math.min(1, step / (minSteps + ENTROPHY_OUTCOMES.length));
            const delay = 45 + Math.pow(progress, 3) * 330; // ~45ms → ~375ms
            setTimeout(tick, delay);
        }

        function land() {
            const outcome = ENTROPHY_OUTCOMES[finalIdx];
            tiles[finalIdx].classList.add('landed');
            panel.querySelector('.entrophy-subtitle').innerHTML =
                `<span class="entrophy-result">${outcome.label}</span> &mdash; ${outcome.sub}`;
            const btn = document.createElement('button');
            btn.className = 'menu-btn combat-btn';
            btn.textContent = outcome.id === 'hand' || outcome.id === 'self' ? 'RESOLVE' : 'ATTACK';
            btn.onclick = () => {
                overlay.remove();
                applyEntrophyOutcome(outcome.id, attacker, attackerSlot, defenderNum, hyperTarget);
            };
            footer.appendChild(btn);

            // Computer's Entrophy: let the result sink in, then resolve itself.
            if (aiTurnInProgress) {
                panel.classList.add('ai-controlled');
                aiLog(`Entrophy rolls: ${outcome.label}`, 'combat');
                setTimeout(() => { if (document.body.contains(btn)) btn.onclick(); }, 1600);
            }
        }

        tick();
    }

    // Build the effective attacker for this roll (Strength/Unblockable ride on top of the base 2).
    function entrophyAttacker(base, outcomeId) {
        const a = { ...base };
        if (outcomeId === 'str3') a.baseStrength = (parseInt(a.baseStrength ?? a.baseHealth) || 0) + 3;
        if (outcomeId === 'unblock') a.unblockable = true;
        return a;
    }

    // Add Time Points to a player (active die first — Day by default, Time Bender can
    // switch it — up to 12 each; a lost die stays lost).
    function gainTimePoints(pNum, amount) {
        const st = playersState[pNum];
        if (!st) return;
        const first = activeDieType(pNum);
        const second = first === 'day' ? 'night' : 'day';
        let rem = amount;
        if (st[first] > 0) { const add = Math.min(12 - st[first], rem); adjustPlayerDie(pNum, first, add); rem -= add; }
        if (rem > 0 && st[second] > 0) adjustPlayerDie(pNum, second, rem);
    }

    function applyEntrophyOutcome(outcomeId, base, slot, defenderNum, hyperTarget = null) {
        switch (outcomeId) {
            case 'none':
            case 'str3':
            case 'unblock':
                initiateDefense(entrophyAttacker(base, outcomeId), slot, defenderNum, hyperTarget);
                break;
            case 'tp4': {
                gainTimePoints(currentPlayer, 4);
                const board = document.getElementById(`player-${currentPlayer}`);
                const dieSel = activeDieSel(currentPlayer);
                if (board) floatValue(board.querySelector(dieSel), '+4 TP', 'gain');
                initiateDefense(entrophyAttacker(base, 'none'), slot, defenderNum, hyperTarget); // attack still lands with 2
                break;
            }
            case 'hand': {
                // No attack — Entrophy is handed to the defending player instead.
                const oppBoard = document.getElementById(`player-${defenderNum}`);
                const empty = oppBoard && oppBoard.querySelector('.hand-slot.slot-empty');
                clearSlot(slot);
                if (empty) finishSingleCardPlacement(empty, { ...base, summonedOnTurn: totalTurns });
                updateHandLayout(defenderNum);
                break;
            }
            case 'self': {
                // Attacks its own controller for 2, then to History.
                resolveDamageDirectly(2, currentPlayer);
                const board = document.getElementById(`player-${currentPlayer}`);
                const dieSel = activeDieSel(currentPlayer);
                if (board) floatValue(board.querySelector(dieSel), '-2 TP', 'damage');
                const hist = slot.closest('.player-zone').querySelector('.history-pile');
                clearSlot(slot);
                finishSingleCardPlacement(hist, base);
                break;
            }
        }
    }

    // A player's total Time Points (both dice combined).
    function totalTimePoints(pNum) {
        const st = playersState[pNum];
        return st ? (st.day + st.night) : 0;
    }

    // Dress the Creature Attack screen: show the attacker's effective attack Strength on its card
    // (this is where Meridius's Landmark buff appears — attack-only), plus both players' Time
    // Points so you can judge whether to block or spend an Artifact.
    function decorateCombatScreen(attacker, attackerSlot, defenderNum) {
        const attackerPreview = document.getElementById('attacker-preview');
        attackerPreview.querySelector('.combat-str-badge')?.remove();
        const badge = document.createElement('div');
        badge.className = 'combat-str-badge tech-font';
        badge.textContent = calculateCurrentStrength(attacker, attackerSlot);
        attackerPreview.appendChild(badge);

        let tpRow = document.getElementById('combat-tp-row');
        if (!tpRow) {
            tpRow = document.createElement('div');
            tpRow.id = 'combat-tp-row';
            tpRow.className = 'tech-font';
            document.getElementById('combat-info').insertAdjacentElement('afterend', tpRow);
        }
        tpRow.innerHTML =
            `<span class="ctp ctp-attacker">P${currentPlayer} (Attacker) &middot; ${totalTimePoints(currentPlayer)} TP</span>` +
            `<span class="ctp ctp-defender">P${defenderNum} (Defender) &middot; ${totalTimePoints(defenderNum)} TP</span>`;
    }

    function initiateDefense(attacker, attackerSlot, defenderNum, hyperTarget = null) {
        const defenderBoard = document.getElementById(`player-${defenderNum}`);
        const defenseOverlay = document.getElementById('defense-overlay');
        const attackerPreview = document.getElementById('attacker-preview');
        const defenderTarget = document.getElementById('defender-target');
        const feedbackEl = document.getElementById('combat-feedback');
        const btnBlock = document.getElementById('btn-block-creature');
        const btnArtifact = document.getElementById('btn-play-artifact');
        const btnContinue = document.getElementById('btn-combat-continue');

        attackerPreview.style.backgroundImage = attackerSlot.style.backgroundImage;
        attackerPreview.classList.remove('battle-tap-attacker');
        defenderTarget.classList.remove('battle-tap-defender');
        feedbackEl.classList.remove('combat-feedback-vital');

        decorateCombatScreen(attacker, attackerSlot, defenderNum);

        // A Creature can never block itself — matters for Tele Control, where the attacker may be
        // one of the defender's own Creatures (commandeered and aimed back at its owner).
        const availableCreatures = Array.from(defenderBoard.querySelectorAll('.creature-zone-main .card:not(.slot-empty)'))
            .filter(s => s !== attackerSlot);
        const artifactsInHand = Array.from(defenderBoard.querySelectorAll('.hand-slot:not(.slot-empty)')).filter(s => {
            const dataStr = s.dataset.cardData;
            if (!dataStr) return false;
            try {
                const d = JSON.parse(dataStr);
                return d.type === 'Artifact';
            } catch(e) { return false; }
        });

        let isBlocking = false;
        let isCombatResolved = false;
        let selectedBlockerSlot = availableCreatures.length > 0 ? availableCreatures[0] : null;

        // A Hyperscope-targeted attack is never blockable — the target is locked in.
        const isUnblockable = attacker.name.includes("Rampadon") || attacker.unblockable || !!hyperTarget;
        if (hyperTarget) {
            btnBlock.disabled = true;
            btnBlock.style.opacity = "0.5";
            if (hyperTarget.kind === 'player') {
                defenderTarget.style.backgroundImage = "";
                defenderTarget.classList.remove('faded', 'active-blocker');
                defenderTarget.textContent = `P${defenderNum}`;
                feedbackEl.textContent = "Hyperscope: Direct Player Strike!";
            } else {
                defenderTarget.style.backgroundImage = hyperTarget.slot.style.backgroundImage;
                defenderTarget.classList.remove('faded');
                defenderTarget.classList.add('active-blocker');
                defenderTarget.textContent = "";
                let lockName = '';
                try { lockName = JSON.parse(hyperTarget.slot.dataset.cardData).name; } catch (e) { /* skip */ }
                feedbackEl.textContent = `Hyperscope Lock: ${lockName}`;
            }
        } else if (isUnblockable) {
             btnBlock.disabled = true;
             btnBlock.style.opacity = "0.5";
             feedbackEl.textContent = "Unblockable Attacker Detected!";
        } else if (availableCreatures.length > 0) {
            const firstCreatureSlot = availableCreatures[0];
            defenderTarget.style.backgroundImage = firstCreatureSlot.style.backgroundImage;
            defenderTarget.classList.add('faded');
            defenderTarget.textContent = "";
            btnBlock.disabled = false;
        } else {
            defenderTarget.style.backgroundImage = "";
            defenderTarget.classList.remove('faded', 'active-blocker');
            defenderTarget.textContent = `P${defenderNum}`;
            btnBlock.disabled = true;
        }

        // Looper strikes 2+ carry no additional effects — Artifact responses included.
        btnArtifact.disabled = artifactsInHand.length === 0 || !!attacker.looperPlainStrike;
        btnBlock.classList.remove('in-use');
        btnArtifact.classList.remove('in-use');
        btnContinue.textContent = "CONTINUE";
        if (!isUnblockable) feedbackEl.textContent = "Direct Damage Selected";
        
        // Ensure options are visible
        btnBlock.classList.remove('hidden');
        btnArtifact.classList.remove('hidden');

        btnBlock.onclick = () => {
            if (isCombatResolved || isUnblockable) return;
            isBlocking = !isBlocking;

            // Remove any existing creature picker
            const existingPicker = document.getElementById('blocker-picker');
            if (existingPicker) existingPicker.remove();

            if (isBlocking) {
                if (availableCreatures.length > 1) {
                    // Show creature selection UI inside the combat modal
                    selectedBlockerSlot = availableCreatures[0];
                    const picker = document.createElement('div');
                    picker.id = 'blocker-picker';
                    picker.style.cssText = 'margin-top:10px;text-align:center;';
                    picker.innerHTML = '<p class="tech-font" style="font-size:10px;opacity:0.7;margin-bottom:6px;">SELECT BLOCKER:</p>';
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center;';
                    availableCreatures.forEach((cSlot, i) => {
                        const cData = JSON.parse(cSlot.dataset.cardData);
                        const btn = document.createElement('button');
                        btn.className = 'menu-btn secondary-btn' + (i === 0 ? ' active' : '');
                        btn.style.cssText = 'padding:4px 8px;font-size:10px;min-width:80px;';
                        btn.textContent = cData.name;
                        btn.onclick = (ev) => {
                            ev.stopPropagation();
                            selectedBlockerSlot = cSlot;
                            defenderTarget.style.backgroundImage = cSlot.style.backgroundImage;
                            defenderTarget.textContent = '';
                            row.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
                        };
                        row.appendChild(btn);
                    });
                    picker.appendChild(row);
                    document.querySelector('.combat-modal').appendChild(picker);

                    // Default to first creature visually
                    defenderTarget.style.backgroundImage = availableCreatures[0].style.backgroundImage;
                    defenderTarget.textContent = '';
                } else {
                    selectedBlockerSlot = availableCreatures[0];
                }
                defenderTarget.classList.remove('faded');
                defenderTarget.classList.add('active-blocker');
                btnBlock.classList.add('in-use');
                feedbackEl.textContent = availableCreatures.length > 1 ? "Select a Blocker" : "Blocking with Creature";
            } else {
                selectedBlockerSlot = null;
                defenderTarget.classList.add('faded');
                defenderTarget.classList.remove('active-blocker');
                btnBlock.classList.remove('in-use');
                feedbackEl.textContent = "Direct Damage Selected";
            }
        };

        btnArtifact.onclick = () => {
            if (isCombatResolved) return;
            if (artifactsInHand.length > 0) {
                defenseOverlay.classList.add('hidden');
                selectArtifactToPlay(attacker, attackerSlot, defenderNum, artifactsInHand, hyperTarget);
            }
        };

        btnContinue.onclick = () => {
            if (isCombatResolved) {
                defenseOverlay.classList.add('hidden');
                maybeCloneSecondStrike();
                return;
            }

            // Lock the phase
            isCombatResolved = true;
            btnBlock.classList.add('hidden');
            btnArtifact.classList.add('hidden');
            btnContinue.textContent = "CLOSE";

            // Clean up creature picker if present
            const pickerEl = document.getElementById('blocker-picker');
            if (pickerEl) pickerEl.remove();

            if (hyperTarget && hyperTarget.kind === 'creature') {
                // Hyperscope: normal combat math against the locked Creature — no block choice.
                feedbackEl.textContent = "Resolving Battle...";
                attackerPreview.classList.add('battle-tap-attacker');
                defenderTarget.classList.add('battle-tap-defender');
                setTimeout(() => {
                    let targetData = null;
                    try { targetData = JSON.parse(hyperTarget.slot.dataset.cardData); } catch (e) { /* skip */ }
                    if (targetData) resolveCombat(attacker, attackerSlot, targetData, hyperTarget.slot, defenderNum);
                }, 400);
            } else if (hyperTarget && hyperTarget.kind === 'landmark') {
                feedbackEl.textContent = "Resolving Strike...";
                attackerPreview.classList.add('battle-tap-attacker');
                defenderTarget.classList.add('battle-tap-defender');
                setTimeout(() => {
                    resolveLandmarkStrike(attacker, attackerSlot, hyperTarget.slot, defenderNum);
                }, 400);
            } else if (isBlocking) {
                const blockerSlot = selectedBlockerSlot || availableCreatures[0];
                const blockerData = JSON.parse(blockerSlot.dataset.cardData);

                feedbackEl.textContent = "Resolving Battle...";
                attackerPreview.classList.add('battle-tap-attacker');
                defenderTarget.classList.add('battle-tap-defender');
                
                setTimeout(() => {
                    resolveCombat(attacker, attackerSlot, blockerData, blockerSlot, defenderNum);
                }, 400);
            } else {
                feedbackEl.textContent = "Resolving Strike...";
                attackerPreview.classList.add('battle-tap-attacker');
                setTimeout(() => {
                    resolveDamageDirect(attacker, attackerSlot, defenderNum);
                }, 400);
            }
        };

        defenseOverlay.classList.remove('hidden');

        // The defender is the Computer: it decides block-or-take on this same
        // screen (visible to you, buttons locked) after a short "thinking" beat.
        if (vsComputer && defenderNum === AI_PLAYER) {
            aiHandleDefense({ attacker, attackerSlot, availableCreatures, isUnblockable, btnBlock, btnContinue, feedbackEl, defenseOverlay, hyperTarget });
        }
    }

    // Automatic blocking logic - selectBlocker removed as per user request


    function resolveDamageDirect(attacker, attackerSlot, defenderNum) {
        const feedbackEl = document.getElementById('combat-feedback');
        feedbackEl.classList.add('combat-feedback-vital');

        const str = calculateCurrentStrength(attacker, attackerSlot);
        feedbackEl.textContent = `Direct Strike for ${str} Damage!`;

        // Cell Shield (A4) prevents the whole hit and turns it into card draws.
        if (!maybeCellShield(str, defenderNum)) resolveDamageDirectly(str, defenderNum);
        applyTimeThiefGain(attacker, attackerSlot, str);

        const attackerHistory = attackerSlot.closest('.player-zone').querySelector('.history-pile');
        finishAttacker(attackerSlot, attacker, attackerHistory);
        // initAllActiveBoards() removed - it was resetting the game.
    }

    // Time Thief gains Time Points equal to the TOTAL damage he deals in an attack,
    // no matter how it's split between a blocking Creature and spillover to the player,
    // and after any Strength debuffs (e.g. Smoke) have already reduced the total.
    // Routed through the shared gainTimePoints(), so a Day die already removed (hit 0)
    // stays removed forever — the gain only ever tops up the Night die in that case.
    function applyTimeThiefGain(attacker, attackerSlot, damageDealt) {
        if (attacker.name !== 'Time Thief' || damageDealt <= 0) return;
        const ownerBoard = attackerSlot.closest('.player-zone');
        const ownerNum = parseInt(ownerBoard.id.split('-')[1]);
        gainTimePoints(ownerNum, damageDealt);
        const dieSel = activeDieSel(ownerNum);
        floatValue(ownerBoard.querySelector(dieSel), `+${damageDealt} TP`, 'gain');
    }

    function calculateCurrentStrength(attacker, attackerSlot) {
        // Looper strikes 2+: additional effects don't apply — plain printed Strength,
        // no buffs (Cabin) and no debuffs (Smoke).
        if (attacker.looperPlainStrike) {
            return Math.max(0, (parseInt(attacker.baseStrength ?? attacker.baseHealth) || 0) - (attacker.damageTaken || 0));
        }
        let bonus = 0;
        if (attacker.name === 'Meridia') {
            bonus = meridiaArtifactBonus(attackerSlot.closest('.player-zone').querySelector('.history-pile'));
        }
        bonus += cabinBonus(attackerSlot.closest('.player-zone'));
        let base = (parseInt(attacker.baseStrength ?? attacker.baseHealth) || 0) + bonus - (attacker.damageTaken || 0);
        return Math.max(0, base - activeStrDebuff);
    }

    function resolveCombat(attacker, attackerSlot, blockerData, blockerSlot, defenderNum) {
        const feedbackEl = document.getElementById('combat-feedback');
        feedbackEl.classList.add('combat-feedback-vital');
        let attackerDefeated = false; // set on mutual destruction — governs the Lotus rider

        const attackerStr = calculateCurrentStrength(attacker, attackerSlot);
        const attackerHistory = attackerSlot.closest('.player-zone').querySelector('.history-pile');
        const blockerHistory = blockerSlot.closest('.player-zone').querySelector('.history-pile');

        // Time Thief deals his full current Strength no matter how the block resolves
        // (absorbed by the blocker, spilled to the player, or both) — gain TP for all of it.
        applyTimeThiefGain(attacker, attackerSlot, attackerStr);

        // Meridia swallows the whole attack: any damage she blocks sacrifices her and
        // prevents ALL remaining damage (no spillover to the player), regardless of Strength.
        if (blockerData.name === 'Meridia') {
            if (attackerStr > 0) {
                feedbackEl.textContent = "Meridia Sacrificed! All Damage Prevented.";
                clearSlot(blockerSlot);
                finishSingleCardPlacement(blockerHistory, blockerData);
                applyRepoStationGain(attackerSlot);
            } else {
                feedbackEl.textContent = "Attacker Repelled! Defender Survives.";
            }
            finishAttacker(attackerSlot, attacker, attackerHistory);
            return;
        }

        const blockerStr = (parseInt(blockerData.baseResistance ?? blockerData.baseHealth) || 0) + cabinBonus(blockerSlot.closest('.player-zone')) - (blockerData.damageTaken || 0);

        if (attackerStr > blockerStr) {
            const overflow = attackerStr - blockerStr;
            feedbackEl.textContent = `Blocker Defeated! ${overflow} Spillover Damage.`;

            if (!maybeMasiotaRescue(blockerSlot, blockerData)) {
                clearSlot(blockerSlot);
                finishSingleCardPlacement(blockerHistory, blockerData);
            }
            applyRepoStationGain(attackerSlot);
            // Cell Shield (A4) prevents the spillover Time Points and draws that many Cards.
            if (!maybeCellShield(overflow, defenderNum)) resolveDamageDirectly(overflow, defenderNum);
        } else if (attackerStr < blockerStr) {
            feedbackEl.textContent = "Attacker Repelled! Defender Survives.";
            blockerData.damageTaken = (blockerData.damageTaken || 0) + attackerStr;
            blockerSlot.dataset.cardData = JSON.stringify(blockerData);
            updateCreatureStatBadge(blockerSlot, blockerData);
        } else {
            feedbackEl.textContent = "Mutual Destruction! Both cards to History.";
            if (!maybeMasiotaRescue(blockerSlot, blockerData)) {
                clearSlot(blockerSlot);
                finishSingleCardPlacement(blockerHistory, blockerData);
            }
            applyRepoStationGain(attackerSlot);
            attackerDefeated = true; // the attacker died too — a Lotus rider goes to History with it
        }

        // Cleanup Attacker - move to history (unless Clone Factory keeps it for a 2nd strike).
        // attackerDefeated flags mutual destruction so a Lotus-borne attacker discards its Lotus.
        finishAttacker(attackerSlot, attacker, attackerHistory, attackerDefeated);
    }

    // Cell Shield (Duality A4): if the defender armed it during this attack's PLAY ARTIFACT step,
    // prevent the Time Points they would lose and draw that many Cards instead. Returns true when
    // it absorbs the hit (the caller then skips applying the damage). The amount is capped at the
    // Time Points the player actually has — you can't "lose" more than you hold.
    function maybeCellShield(amount, defenderNum) {
        if (cellShieldDefender !== defenderNum) return false;
        cellShieldDefender = null; // one attack only
        const prevented = Math.min(amount, totalTimePoints(defenderNum));
        const feedbackEl = document.getElementById('combat-feedback');
        if (feedbackEl) feedbackEl.textContent = `Cell Shield! ${prevented} Time Points prevented — draw ${prevented}.`;
        const board = document.getElementById(`player-${defenderNum}`);
        if (board) floatValue(board.querySelector(activeDieSel(defenderNum)), `Shielded +${prevented} Cards`, 'gain');
        if (prevented > 0) drawCards(defenderNum, prevented);
        return true;
    }

    function resolveDamageDirectly(damage, playerNum) {
        const state = playersState[playerNum];
        if (!state) return;
        
        let remain = damage;
        // Reduce the active die first (Day by default; Time Bender can switch it).
        const first = activeDieType(playerNum);
        const second = first === 'day' ? 'night' : 'day';
        if (state[first] > 0) {
            const dec = Math.min(state[first], remain);
            state[first] -= dec;
            remain -= dec;
        }
        if (remain > 0 && state[second] > 0) {
            state[second] = Math.max(0, state[second] - remain);
        }
        
        updatePlayerDieUI(playerNum, 'day');
        updatePlayerDieUI(playerNum, 'night');
        
        if (state.day <= 0 && state.night <= 0) {
            checkGameOver();
        }
    }

    function resolveBlock(attacker, attackerSlot, defenderNum) {
        const defenderBoard = document.getElementById(`player-${defenderNum}`);
        // Face-down (deactivated) creatures are asleep — they can't block.
        const availableCreatures = Array.from(defenderBoard.querySelectorAll('.creature-zone-main .card:not(.slot-empty)')).filter(s => {
            try { const c = JSON.parse(s.dataset.cardData); return c.type === 'Creature' && !c.deactivated; } catch (e) { return false; }
        });
        if (availableCreatures.length === 0) {
            const dmg = parseInt(attacker.baseStrength ?? attacker.baseHealth) || 0;
            if (!maybeCellShield(dmg, defenderNum)) resolveDamageDirectly(dmg, defenderNum);
            return;
        }
        selectBlocker(attacker, attackerSlot, defenderNum, availableCreatures);
    }


    function passDevice(toPlayer, callback, customBtnText = "START TURN") {
        // Vs Computer there is only one human at the device — no hand-off needed.
        if (vsComputer) { if (callback) callback(); return; }
        const overlay = document.getElementById('pass-device-overlay');
        const hint = document.getElementById('next-player-hint');
        const btn = document.getElementById('start-turn-btn');
        
        hint.textContent = `PLAYER ${toPlayer}`;
        btn.textContent = customBtnText;
        overlay.classList.remove('hidden');
        
        btn.onclick = () => {
            overlay.classList.add('hidden');
            if (callback) callback();
        };
    }

    function selectArtifactToPlay(attacker, attackerSlot, defenderNum, handSlots, hyperTarget = null) {
        passDevice(defenderNum, () => {
            // Switch View to Defender
            document.querySelectorAll('.player-zone').forEach(z => z.classList.remove('active-player'));
            document.getElementById(`player-${defenderNum}`).classList.add('active-player');
            const gameField = document.getElementById('game-field');
            const originalClass = gameField.className;
            gameField.className = `players-${activePlayerCount} turn-p${defenderNum}`;
            
            document.body.classList.add('artifact-selection-active');
            let selectedSlots = [];

            // Temporary Continue button
            const followUp = document.createElement('button');
            followUp.className = 'menu-btn combat-btn sticky-confirm';
            followUp.textContent = 'CONFIRM SELECTION';
            followUp.style.position = 'fixed';
            followUp.style.bottom = '40px';
            followUp.style.left = '50%';
            followUp.style.transform = 'translateX(-50%)';
            followUp.style.width = '240px';
            followUp.style.zIndex = '6000';
            document.body.appendChild(followUp);

            handSlots.forEach(slot => {
                slot.classList.add('valid-block-target');
                // Use capturing listener to override the default grab behavior
                const listener = (e) => {
                    e.stopImmediatePropagation();
                    e.stopPropagation();
                    if (slot.classList.contains('selected')) {
                        slot.classList.remove('selected');
                        selectedSlots = selectedSlots.filter(s => s !== slot);
                    } else {
                        slot.classList.add('selected');
                        selectedSlots.push(slot);
                    }
                };
                slot.addEventListener('click', listener, true);
                slot._selectionListener = listener; // Store for removal
            });

            followUp.onclick = () => {
                // Process Multi-Selection
                let smokesPlayed = 0;
                let reflectorPlayed = false;
                selectedSlots.forEach(slot => {
                    const artifactData = JSON.parse(slot.dataset.cardData);
                    const history = slot.closest('.player-zone').querySelector('.history-pile');
                    clearSlot(slot);
                    finishSingleCardPlacement(history, artifactData);

                    // CARD EFFECT: SMOKE (Stackable)
                    if (artifactData.name === "Smoke") {
                        activeStrDebuff += 1;
                        smokesPlayed++;
                    }

                    // CARD EFFECT: REFLECTOR - redirects the attack instead of blocking/debuffing it.
                    if (artifactData.name === "Reflector") {
                        reflectorPlayed = true;
                    }

                    // CARD EFFECT: CELL SHIELD (A4) - arm it; the Time Points this attack would
                    // cost the defender are prevented and turned into card draws when the damage
                    // resolves (see maybeCellShield in the direct-strike / spillover paths).
                    if (artifactData.name === "Cell Shield") {
                        cellShieldDefender = defenderNum;
                    }
                });

                // Update all attackers visually to show the new debuff
                document.querySelectorAll(`.p${currentPlayer} .creature-zone-main .card:not(.slot-empty)`).forEach(s => {
                    const data = JSON.parse(s.dataset.cardData);
                    updateCreatureStatBadge(s, data);
                });

                followUp.remove();
                document.body.classList.remove('artifact-selection-active');
                handSlots.forEach(s => {
                    s.classList.remove('valid-block-target', 'selected');
                    if (s._selectionListener) {
                        s.removeEventListener('click', s._selectionListener, true);
                        delete s._selectionListener;
                    }
                });
                
                // Refresh combat feedback to show the debuff if any smokes played
                if (smokesPlayed > 0) {
                     const feedback = document.getElementById('combat-feedback');
                     feedback.textContent = `Smoke deployed! Attackers -${smokesPlayed} Strength this turn.`;
                     feedback.classList.add('combat-feedback-vital');
                }
                
                // Switch View back to Attacker
                document.querySelectorAll('.player-zone').forEach(z => z.classList.remove('active-player'));
                document.getElementById(`player-${currentPlayer}`).classList.add('active-player');
                gameField.className = originalClass;

                if (reflectorPlayed) {
                    // Reflector redirects the attack instead of resuming the normal defense screen.
                    handleReflectorRedirect(attacker, attackerSlot, defenderNum, hyperTarget);
                } else {
                    // Return to defense overlay
                    const defenseOverlay = document.getElementById('defense-overlay');
                    defenseOverlay.classList.remove('hidden');
                    initiateDefense(attacker, attackerSlot, defenderNum, hyperTarget);
                }
            };
        }, "SELECT ARTIFACT");
    }

    // Generic contextual response: before an Artifact's effect against `targetPlayerNum`
    // resolves, give them a chance to play Talisman (if they're holding it) to prevent it —
    // Talisman's text ("prevent a Card that targets you or any of your Cards") isn't specific
    // to any one Artifact, so this is written to work for Reflector today and any future
    // targeted Artifact/Creature effect without changes. The device is passed to the target
    // first so hand contents stay hidden from whoever currently holds it; if they don't have
    // Talisman there's nothing to decide, so the effect proceeds automatically.
    function offerTalismanResponse(targetPlayerNum, sourceCardName, { onPrevented, onProceed }) {
        // The Computer responds by itself: it plays Talisman whenever it holds one
        // (a prevented targeted effect is nearly always worth the card).
        if (vsComputer && targetPlayerNum === AI_PLAYER) {
            const aiBoardEl = document.getElementById(`player-${AI_PLAYER}`);
            const talisman = Array.from(aiBoardEl.querySelectorAll('.hand-slot:not(.slot-empty)')).find(s => {
                try { return JSON.parse(s.dataset.cardData).name === 'Talisman'; } catch (e) { return false; }
            });
            if (!talisman) { onProceed(); return; }
            setTimeout(() => {
                const talismanData = JSON.parse(talisman.dataset.cardData);
                const history = aiBoardEl.querySelector('.history-pile');
                clearSlot(talisman);
                finishSingleCardPlacement(history, talismanData);
                updateHandLayout(AI_PLAYER);
                aiLog(`Plays Talisman — ${sourceCardName} prevented!`, 'combat');
                onPrevented();
            }, 1100);
            return;
        }

        const gameField = document.getElementById('game-field');
        const originalClass = gameField.className;
        const originallyActive = document.querySelector('.player-zone.active-player');
        const restoreView = () => {
            document.querySelectorAll('.player-zone').forEach(z => z.classList.remove('active-player'));
            if (originallyActive) originallyActive.classList.add('active-player');
            gameField.className = originalClass;
        };

        passDevice(targetPlayerNum, () => {
            const targetBoard = document.getElementById(`player-${targetPlayerNum}`);
            document.querySelectorAll('.player-zone').forEach(z => z.classList.remove('active-player'));
            targetBoard.classList.add('active-player');
            gameField.className = `players-${activePlayerCount} turn-p${targetPlayerNum}`;

            const talismanSlot = Array.from(targetBoard.querySelectorAll('.hand-slot:not(.slot-empty)'))
                .find(s => {
                    try { return JSON.parse(s.dataset.cardData).name === 'Talisman'; }
                    catch (e) { return false; }
                });

            if (!talismanSlot) { restoreView(); onProceed(); return; }

            const overlay = document.createElement('div');
            overlay.className = 'overlay';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:7000;display:flex;align-items:center;justify-content:center;';
            overlay.innerHTML = `
                <div class="glass-panel modal-content" style="max-width:320px;text-align:center;padding:20px;">
                    <h3 class="tech-font">RESPOND?</h3>
                    <p class="tech-font" style="font-size:13px;opacity:0.85;margin:8px 0 16px;">
                        Player ${targetPlayerNum}, ${sourceCardName} is targeting you. Play Talisman to prevent it?
                    </p>
                    <div style="display:flex;gap:10px;justify-content:center;">
                        <button class="menu-btn combat-btn" id="talisman-yes">PLAY TALISMAN</button>
                        <button class="menu-btn secondary-btn" id="talisman-no">ALLOW EFFECT</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);

            overlay.querySelector('#talisman-yes').onclick = () => {
                const talismanData = JSON.parse(talismanSlot.dataset.cardData);
                const history = targetBoard.querySelector('.history-pile');
                clearSlot(talismanSlot);
                finishSingleCardPlacement(history, talismanData);
                updateHandLayout(targetPlayerNum);
                overlay.remove();
                restoreView();
                onPrevented();
            };
            overlay.querySelector('#talisman-no').onclick = () => {
                overlay.remove();
                restoreView();
                onProceed();
            };
        }, "RESOLVE RESPONSE");
    }

    // Reflector (A3): "Change the attack target to a Player of your choice." V1 is 2-player
    // only, so the only choice is the attacker themself — the attack bounces straight back.
    // Before it lands, offer the newly-targeted player (the attacker) a Talisman response.
    function handleReflectorRedirect(attacker, attackerSlot, defenderNum, hyperTarget = null) {
        const newTarget = currentPlayer;
        offerTalismanResponse(newTarget, 'Reflector', {
            onPrevented: () => {
                passDevice(defenderNum, () => {
                    document.querySelectorAll('.player-zone').forEach(z => z.classList.remove('active-player'));
                    document.getElementById(`player-${defenderNum}`).classList.add('active-player');
                    document.getElementById('game-field').className = `players-${activePlayerCount} turn-p${defenderNum}`;
                    document.getElementById('defense-overlay').classList.remove('hidden');
                    initiateDefense(attacker, attackerSlot, defenderNum, hyperTarget);
                    const feedbackEl = document.getElementById('combat-feedback');
                    feedbackEl.textContent = "Talisman prevents Reflector! Attack proceeds normally.";
                    feedbackEl.classList.add('combat-feedback-vital');
                }, "RESUME DEFENSE");
            },
            onProceed: () => resolveReflectedAttack(attacker, attackerSlot, newTarget)
        });
    }

    // Reflector's redirect resolved: the attack lands on the new target directly (it's being
    // bounced back, not freshly declared, so no blocking step), then the attacker goes to History.
    function resolveReflectedAttack(attacker, attackerSlot, newTargetNum) {
        const defenseOverlay = document.getElementById('defense-overlay');
        const feedbackEl = document.getElementById('combat-feedback');
        const btnBlock = document.getElementById('btn-block-creature');
        const btnArtifact = document.getElementById('btn-play-artifact');
        const btnContinue = document.getElementById('btn-combat-continue');

        defenseOverlay.classList.remove('hidden');
        btnBlock.classList.add('hidden');
        btnArtifact.classList.add('hidden');
        feedbackEl.classList.add('combat-feedback-vital');

        const str = calculateCurrentStrength(attacker, attackerSlot);
        feedbackEl.textContent = `Reflected! Attack redirected to Player ${newTargetNum} for ${str} Damage!`;
        resolveDamageDirectly(str, newTargetNum);

        const attackerHistory = attackerSlot.closest('.player-zone').querySelector('.history-pile');
        finishAttacker(attackerSlot, attacker, attackerHistory);

        btnContinue.textContent = "CLOSE";
        btnContinue.onclick = () => { defenseOverlay.classList.add('hidden'); maybeCloneSecondStrike(); };
    }

    function showCardDetails(card, showBazaarStack = false) {
        const cardImg = document.getElementById('modal-card-img');
        const cardDetails = document.getElementById('card-details');
        const pdfCard = document.createElement('div'); // Temporary or re-use? 
        // The modal-content only has modal-card-img and card-details.
        // Let's add a container for the PDF-like rendering in the modal if it's Duality.
        
        let pdfTemplate = document.getElementById('modal-pdf-template');
        if (!pdfTemplate) {
            // Create the template structure in the modal if it doesn't exist
            const modalContent = document.querySelector('.card-modal-content');
            pdfTemplate = document.getElementById('pdf-card-template').cloneNode(true);
            pdfTemplate.id = 'modal-pdf-template';
            modalContent.appendChild(pdfTemplate);
        }

        // Reset visibility
        cardImg.classList.add('hidden');
        cardImg.style.display = 'none';
        cardDetails.classList.add('hidden');
        pdfTemplate.classList.add('hidden');
        pdfTemplate.style.display = 'none';

        // Duality Bazaar cards now have prototype scans (cardArtUrl), so only the
        // art-less ones (Destiny, placeholders) still render via the PDF template.
        if (card.set === 'Duality' && !cardArtUrl(card)) {
            // Render Duality using PDF Template
            renderCardInTemplate(card, pdfTemplate);
            pdfTemplate.classList.remove('hidden');
            pdfTemplate.style.display = 'flex';
            pdfTemplate.classList.add('duality-card');

            if (card.type === 'Destiny') {
                pdfTemplate.classList.add('destiny-duality');
            } else {
                pdfTemplate.classList.remove('destiny-duality');
            }

            if (card.name === '(Coming soon)') {
                pdfTemplate.querySelector('.pdf-name').textContent = 'Coming Soon';
                pdfTemplate.querySelector('.pdf-desc').textContent = 'This card is currently under development.';
            }

        } else {
            // Unity or Steam
            // Always populate background data
            document.getElementById('modal-card-name').textContent = card.name || '-';
            document.getElementById('detail-type').textContent = card.type || '-';
            document.getElementById('detail-cost').textContent = card.cost || '-';
            document.getElementById('detail-rarity').textContent = card.rarity || '-';
            document.getElementById('detail-set').textContent = card.set || '-';
            document.getElementById('detail-number').textContent = card.number || '-';
            document.getElementById('detail-location').textContent = card.location || '-';
            
            const descEl = document.getElementById('detail-desc');
            if (card.description) {
                let desc = card.description;
                Object.keys(keywordsMap).forEach(kw => {
                    const regex = new RegExp(`\\b${kw}\\b`, 'gi');
                    desc = desc.replace(regex, match => {
                        return `<span class="keyword-link" onclick="window.showKeyword('${kw}')">${match}</span>`;
                    });
                });
                descEl.innerHTML = desc;
            } else {
                descEl.textContent = '-';
            }

            document.getElementById('detail-lore').textContent = card.lore || '';

            cardImg.classList.remove('hidden');
            cardImg.style.display = 'block';

            if (card.type === 'Steam') {
                if (card.name === 'FireSteam') cardImg.src = 'assets/firesteam.png';
                else if (card.name === 'GoldSteam') cardImg.src = 'assets/goldsteam.png';
                else if (card.name === 'LaserSteam') cardImg.src = 'assets/lasersteam.png';
                else cardImg.src = 'assets/card_back.png';
            } else if (card.type === 'Destiny Abyss') {
                cardImg.src = 'assets/destiny_back.png';
                cardImg.style.display = 'none';
            } else {
                cardImg.src = cardArtUrl(card) || 'assets/card_back.png';
            }
        }

        // --- Handle Modal Inventory Stack ---
        const modalContainer = document.querySelector('.card-modal-content');
        modalContainer.querySelectorAll('.modal-stack-back').forEach(b => b.remove());

        const loc = card.location;
        const remainingInBazaar = (activeBazaar[loc] || []).filter(c => selectedSets.includes(c.set)).length;

        if (showBazaarStack && remainingInBazaar > 1) {
            // Place remaining cards ABOVE the main card (subtract current = 1)
            for (let i = 0; i < Math.min(remainingInBazaar - 1, 10); i++) {
                const back = document.createElement('div');
                back.className = 'modal-stack-back';
                if (card.type === 'Destiny' || loc === 'D' || loc === 'DA') {
                    back.style.backgroundImage = 'url("assets/destiny_back.png")';
                } else {
                    back.style.backgroundImage = 'url("assets/card_back.png")';
                }
                // Increase offset to see the card art properly
                back.style.top = `-${(i + 1) * 30}px`; 
                back.style.zIndex = -1 - i;
                modalContainer.appendChild(back);
            }
        }

        cardModal.classList.remove('hidden');
    }

    function slugify(name) {
        if (!name) return '';
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    }

    // Resolves a card's art image, or null when no art exists (Destiny, placeholders).
    // Unity art lives in assets/cards/, Duality prototype scans in assets/cards/duality/.
    function cardArtUrl(card) {
        if (!card || !card.name || card.name === '(Coming soon)') return null;
        const slug = slugify(card.name);
        if (!slug) return null;
        if (card.type === 'Steam') return `assets/${slug}.png`;
        if (card.type === 'Destiny' || card.type === 'Destiny Abyss') return null;
        if (card.set === 'Unity') return `assets/cards/${slug}.png`;
        if (card.set === 'Duality') return `assets/cards/duality/${slug}.png`;
        return null;
    }

    function showPreviewDetails(card) {
        const cardImg = document.getElementById('preview-card-img');
        const pdfCard = document.getElementById('pdf-card-template');

        // Reset visibility
        cardImg.classList.add('hidden');
        cardImg.style.display = 'none';
        pdfCard.classList.add('hidden');
        pdfCard.style.display = 'none';

        if (card.set === 'Duality' && !cardArtUrl(card)) {
            renderCardInTemplate(card, pdfCard);
            pdfCard.classList.remove('hidden');
            pdfCard.style.display = 'flex';
            pdfCard.classList.add('duality-card');

            if (card.type === 'Destiny') {
                pdfCard.classList.add('destiny-duality');
            } else {
                pdfCard.classList.remove('destiny-duality');
            }
        } else {
            // Unity, Steam, or Duality with prototype art
            pdfCard.classList.remove('duality-card');
            pdfCard.classList.remove('destiny-duality');

            // Path logic
            cardImg.classList.remove('hidden');
            cardImg.style.display = 'block';

            if (card.type === 'Steam') {
                if (card.name === 'FireSteam') cardImg.src = 'assets/firesteam.png';
                else if (card.name === 'GoldSteam') cardImg.src = 'assets/goldsteam.png';
                else if (card.name === 'LaserSteam') cardImg.src = 'assets/lasersteam.png';
                else cardImg.src = 'assets/card_back.png';
            } else if (card.type === 'Destiny Abyss') {
                cardImg.src = 'assets/destiny_back.png';
                if (card.name === 'Destiny Abyss') {
                    cardImg.style.display = 'none';
                }
            } else {
                cardImg.src = cardArtUrl(card) || 'assets/card_back.png';
            }
        }

        locationCardPreview.classList.remove('hidden');
    }

    function renderCardInTemplate(card, template) {
        const nameEl = template.querySelector('.pdf-name') || template.querySelector('#preview-card-name');
        const costEl = template.querySelector('.pdf-cost') || template.querySelector('#preview-cost');
        const rarityEl = template.querySelector('.pdf-rarity span') || template.querySelector('#preview-rarity');
        const typeEl = template.querySelector('.pdf-type-badge') || template.querySelector('#preview-type');
        const descEl = template.querySelector('.pdf-desc') || template.querySelector('#preview-desc');
        const healthEl = template.querySelector('.pdf-health') || template.querySelector('#preview-health');
        const healthValEl = template.querySelector('.health-val') || template.querySelector('#preview-health-val');
        const numEl = template.querySelector('.pdf-meta span:first-child') || template.querySelector('#preview-number');
        const typeSmallEl = template.querySelector('.pdf-meta span:nth-child(2)') || template.querySelector('#preview-type-small');
        const loreEl = template.querySelector('.pdf-lore') || template.querySelector('#preview-lore');

        if (nameEl) nameEl.textContent = card.name || '-';
        if (rarityEl) rarityEl.textContent = card.rarity || '-';
        if (typeEl) typeEl.textContent = (card.type || '').toUpperCase();
        if (numEl) numEl.textContent = card.number || '-';
        if (typeSmallEl) typeSmallEl.textContent = card.type || '-';
        
        if (costEl) {
            costEl.innerHTML = '';
            if (card.cost && card.cost !== '-') {
                for (let i = 0; i < card.cost.length; i++) {
                    const char = card.cost[i];
                    const orb = document.createElement('div');
                    orb.className = 'cost-orb cost-' + char;
                    costEl.appendChild(orb);
                }
            }
        }
        
        if (descEl) {
            let desc = card.description || '';
            Object.keys(keywordsMap).forEach(kw => {
                const regex = new RegExp(`\\b${kw}\\b`, 'gi');
                desc = desc.replace(regex, match => {
                    return `<span class="keyword-link" onclick="window.showKeyword('${kw}')">${match}</span>`;
                });
            });
            descEl.innerHTML = desc;
        }

        if (loreEl) loreEl.textContent = card.lore ? '"' + card.lore + '"' : '';

        if (healthEl) {
            if (card.type === 'Creature' && card.health) {
                healthEl.classList.remove('hidden');
                if (healthValEl) healthValEl.textContent = card.health;
            } else {
                healthEl.classList.add('hidden');
            }
        }

        let bgColor = '#444'; 
        const typeLower = (card.type || '').toLowerCase();
        if(typeLower === 'landmark') bgColor = '#8db59d';
        if(typeLower === 'creature') bgColor = '#819bcf';
        if(typeLower === 'artifact') bgColor = '#a086b5';
        if(typeLower === 'spark') bgColor = '#a8a8aa';
        if(typeLower === 'destiny') bgColor = '#222';
        template.style.backgroundColor = bgColor;
    }

    // --- Player Count Toggle ---
    playerCountToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('.toggle-btn');
        if (!btn) return;

        if (btn.classList.contains('disabled')) {
            showInfoToast('COMING SOON', `${btn.dataset.count}-Player mode is still in the workshop. Only 2 players for now.`);
            return;
        }

        playerCountToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        activePlayerCount = parseInt(btn.dataset.count);
        gameField.className = `players-${activePlayerCount}`;

        // Re-init boards
        initAllActiveBoards();
    });

    // --- Turn & Phase Logic ---
    function setupTurnControl() {
        const nextPhaseBtn = document.getElementById('next-phase-btn');
        const startTurnBtn = document.getElementById('start-turn-btn');
        
        if (nextPhaseBtn) nextPhaseBtn.onclick = progressPhase;
        if (startTurnBtn) startTurnBtn.onclick = startTurn;
        
        document.addEventListener('keydown', (e) => {
            const phaseDisplay = document.getElementById('game-phase-display');
            const passOverlay = document.getElementById('pass-device-overlay');
            
            if (e.code === 'Space') {
                if (aiTurnInProgress) { e.preventDefault(); return; }
                if (!gameStarted) {
                    e.preventDefault();
                    if (window.handleStartGame) window.handleStartGame();
                } else if (passOverlay && !passOverlay.classList.contains('hidden')) {
                    e.preventDefault();
                    startTurn();
                } else if (phaseDisplay && !phaseDisplay.classList.contains('hidden')) {
                    // Only if overlay is NOT showing
                    e.preventDefault();
                    progressPhase();
                }
            }
        });
    }

    function progressPhase() {
        if (gameWon) return; // Disable all phase interaction if game won
        // While the Computer plays, only the Computer itself may advance phases.
        if (aiTurnInProgress && !aiDriving) return;

        // Safety net: leaving Construction with uncommitted Planetarium discards still
        // grants the owed draws, so a forgotten click never eats your cards.
        if (currentPhase === 1 && planetariumStaged > 0) commitPlanetarium();

        // Changing phase closes any armed Landmark context (e.g. Lethargo's Temple).
        if (lethargoActive) deactivateLethargo();
        if (rhoneContextOpen) closeRhoneContext();
        if (aetherlabActive) deactivateAetherlab();

        // Leaving the Creature Phase drops an unused Clone Factory priming (GoldSteam already spent).
        if (currentPhase === 2 && cloneFactoryArmed && !cloneSecondStrikePending) disarmCloneFactory();

        if (currentPhase === 3) {
            // Over the hand limit: clicking "Discard" auto-discards the cheapest cards
            if (!canEndTurn()) {
                autoDiscardToLimit();
                return;
            }
        }

        if (currentPhase < 3) {
            currentPhase++;
            updatePhaseUI();
        } else {
            finishTurn();
        }
    }

    function canEndTurn() {
        const board = document.getElementById(`player-${currentPlayer}`);
        if (!board) return true;

        let maxHand = 5;
        const landmarks = Array.from(board.querySelectorAll('.landmark-zone-main .card:not(.slot-empty)'));
        landmarks.forEach(s => {
            try {
                const data = JSON.parse(s.dataset.cardData);
                if (data.name === 'Pandorama' && !data.deactivated) maxHand += 2;
            } catch(e) {}
        });

        const handSlots = Array.from(board.querySelectorAll('.hand-slot'));
        const occupiedCount = handSlots.filter(s => !s.classList.contains('slot-empty')).length;

        return occupiedCount <= maxHand;
    }

    function updatePhaseUI() {
        if (currentPhase !== 1) rhoneChargedThisPhase = false; // Hand of Rhone charges once per Construction Phase
        const blocks = document.querySelectorAll('.phase-block');
        blocks.forEach((b, i) => {
            b.classList.toggle('active', i === currentPhase);
        });

        const btn = document.getElementById('next-phase-btn');
        const skipBtn = document.getElementById('skip-turn-btn');

        if (btn) {
            if (currentPhase === 3) {
                btn.textContent = 'End Turn';
                triggerEndPhaseDrawing();
            } else {
                btn.textContent = 'Next Phase';
                endPhaseTriggered = false; // Reset for next cycle
                if (currentPhase === 1) { aetherlabUsedThisPhase = false; timeBenderUsedThisPhase = false; chargeHandOfRhone(); } // Reset per-Construction effects + auto-charge
            }
        }

        if (skipBtn) {
            // Show Skip Turn ONLY in Steam Phase (0)
            if (currentPhase === 0) {
                skipBtn.classList.remove('hidden');
            } else {
                skipBtn.classList.add('hidden');
            }
        }

        if (window.updateBazaarLighting) window.updateBazaarLighting();
        checkHandLimit();
    }

    // Card value for the auto-discard heuristic (lower = cheaper = discarded first).
    // Steam TIER dominates pip count: Laser > Gold > Fire > AllSteam (cheapest).
    // So a single Laser outranks any number of Fires; an empty/'-' cost (e.g. FireSteam) is cheapest of all.
    function cardCostValue(card) {
        const cost = (card && card.cost) ? String(card.cost) : '';
        let nF = 0, nG = 0, nL = 0, nA = 0;
        for (const ch of cost) {
            if (ch === 'F') nF++;
            else if (ch === 'G') nG++;
            else if (ch === 'L') nL++;
            else if (ch === 'A') nA++;
        }
        return nL * 1e6 + nG * 1e4 + nF * 1e2 + nA;
    }

    function getMaxHand(board) {
        let maxHand = 5;
        board.querySelectorAll('.landmark-zone-main .card:not(.slot-empty)').forEach(s => {
            try { const d = JSON.parse(s.dataset.cardData); if (d.name === 'Pandorama' && !d.deactivated) maxHand += 2; } catch (e) {}
        });
        return maxHand;
    }

    // Discard the cheapest cards from the current player's hand down to the hand limit.
    function autoDiscardToLimit() {
        const board = document.getElementById(`player-${currentPlayer}`);
        if (!board) return;

        const maxHand = getMaxHand(board);
        const occupied = Array.from(board.querySelectorAll('.hand-slot'))
            .filter(s => !s.classList.contains('slot-empty'));
        const need = occupied.length - maxHand;
        if (need <= 0) return;

        const ranked = occupied.map(s => {
            let card;
            try { card = JSON.parse(s.dataset.cardData); } catch (e) { card = {}; }
            return { slot: s, card, value: cardCostValue(card) };
        }).sort((a, b) => a.value - b.value);

        const historySlot = board.querySelector('.history-pile');
        ranked.slice(0, need).forEach(({ slot, card }) => {
            if (historySlot) finishSingleCardPlacement(historySlot, card);
            clearSlot(slot);
        });

        checkHandLimit();
    }

    function checkHandLimit() {
        const board = document.getElementById(`player-${currentPlayer}`);
        if (!board) return;
        
        let maxHand = 5;
        // Check for Pandorama in Landmark Zone
        const landmarks = Array.from(board.querySelectorAll('.landmark-zone-main .card:not(.slot-empty)'));
        landmarks.forEach(s => {
            try {
                const data = JSON.parse(s.dataset.cardData);
                if (data.name === 'Pandorama' && !data.deactivated) maxHand += 2;
            } catch(e) {}
        });

        const handSlots = Array.from(board.querySelectorAll('.hand-slot'));
        const occupiedSlots = handSlots.filter(s => !s.classList.contains('slot-empty'));
        const occupiedCount = occupiedSlots.length;

        handSlots.forEach((s, idx) => {
            // Apply overflow style to cards beyond the limit
            if (idx >= maxHand && !s.classList.contains('slot-empty')) {
                s.classList.add('overflow-slot');
            } else {
                s.classList.remove('overflow-slot');
            }
        });

        const btn = document.getElementById('next-phase-btn');
        if (btn && currentPhase === 3) {
            const currentOK = canEndTurn();
            
            if (!currentOK) {
                // Determine how many to discard
                const board = document.getElementById(`player-${currentPlayer}`);
                let maxHand = 5;
                const landmarks = Array.from(board.querySelectorAll('.landmark-zone-main .card:not(.slot-empty)'));
                landmarks.forEach(s => {
                    try {
                        const data = JSON.parse(s.dataset.cardData);
                        if (data.name === 'Pandorama' && !data.deactivated) maxHand += 2;
                    } catch(e) {}
                });
                const handSlots = Array.from(board.querySelectorAll('.hand-slot'));
                const occupiedCount = handSlots.filter(s => !s.classList.contains('slot-empty')).length;

                // Keep clickable: clicking it auto-discards the cheapest cards
                btn.disabled = false;
                btn.classList.remove('disabled');
                btn.classList.add('discard-mode');
                btn.textContent = `Discard (${occupiedCount - maxHand})`;
            } else {
                btn.disabled = false;
                btn.classList.remove('disabled');
                btn.classList.remove('discard-mode');
                btn.textContent = 'End Turn';
            }
        }
    }

    let endPhaseTriggered = false; // Prevent multiple triggers in same phase
    let aetherlabUsedThisPhase = false;
    let aetherlabActive = false; // Aetherlab upgrade mode armed (Method A)

    async function animateReshuffle(pNum) {
        const board = document.getElementById(`player-${pNum}`);
        const historyPile = board.querySelector('.history-pile');
        const futurePile = board.querySelector('.future-pile');
        
        const historyRect = historyPile.getBoundingClientRect();
        const futureRect = futurePile.getBoundingClientRect();
        
        // Move 3 "ghost cards" to represent the pile moving
        for (let i = 0; i < 3; i++) {
            const ghost = document.createElement('div');
            ghost.className = 'held-card-ghost';
            ghost.style.position = 'fixed';
            ghost.style.left = historyRect.left + 'px';
            ghost.style.top = historyRect.top + 'px';
            ghost.style.zIndex = '3000';
            ghost.style.backgroundImage = "url('assets/card_back.png')";
            document.body.appendChild(ghost);
            
            ghost.offsetHeight; // Force layout
            
            ghost.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
            ghost.style.left = futureRect.left + 'px';
            ghost.style.top = futureRect.top + 'px';
            ghost.style.opacity = '0';
            ghost.style.transform = 'scale(0.8)';
            
            setTimeout(() => ghost.remove(), 700);
            await new Promise(r => setTimeout(r, 150));
        }
    }

    async function triggerEndPhaseDrawing() {
        if (endPhaseTriggered) return;
        endPhaseTriggered = true;
        const drawCount = turnSkipped ? 3 : 2;
        await drawCards(currentPlayer, drawCount);
    }

    // Draw `drawCount` cards from a player's Future pile into their hand, with the same
    // reshuffle + deal animation the End Phase uses. Shared by End Phase and Planetarium.
    async function drawCards(pNum, drawCount) {
        const board = document.getElementById(`player-${pNum}`);
        if (!board) return;

        const futurePile = board.querySelector('.future-pile');
        const historyPile = board.querySelector('.history-pile');
        if (!futurePile || !historyPile) return;

        const getFutureData = () => {
            try { return JSON.parse(futurePile.dataset.cardData || '[]'); } catch(e) { return []; }
        };
        const getHistoryData = () => {
            try { return JSON.parse(historyPile.dataset.cardData || '[]'); } catch(e) { return []; }
        };

        const initialFuture = getFutureData();
        const initialHistory = getHistoryData();
        const totalAvailable = initialFuture.length + initialHistory.length;
        const actualDraw = Math.min(drawCount, totalAvailable);

        const targets = [];
        for (let i = 0; i < actualDraw; i++) {
            const allSlots = Array.from(board.querySelectorAll('.hand-slot'));
            let targetSlot = allSlots.find(s => s.classList.contains('slot-empty') && !targets.includes(s));
            if (!targetSlot) {
                targetSlot = createSlot('hand');
                targetSlot.classList.add('temporary-slot');
                board.querySelector('.hand-slots').appendChild(targetSlot);
            }
            targets.push(targetSlot);
        }

        // Use a loop instead of simple forEach to handle async reshuffle if needed
        let reshuffled = false;
        for (let i = 0; i < targets.length; i++) {
            const targetSlot = targets[i];

            let currentFuture = getFutureData();

            if (currentFuture.length === 0) {
                let currentHistory = getHistoryData();
                if (currentHistory.length > 0) {
                    // PERFORM VISUAL RESHUFFLE
                    await animateReshuffle(pNum);
                    reshuffled = true;

                    // Meridia can't survive being folded back into a new Future Pile —
                    // she's discarded to the Abyss instead when History reshuffles.
                    const meridiaCards = currentHistory.filter(c => c.name === 'Meridia');
                    const shuffleable = currentHistory.filter(c => c.name !== 'Meridia');
                    if (meridiaCards.length) {
                        activeBazaar['AB'] = (activeBazaar['AB'] || []).concat(meridiaCards);
                        renderBazaar();
                    }

                    currentFuture = shuffleArray([...shuffleable]);
                    historyPile.dataset.cardData = JSON.stringify([]);
                    updateStackIndicator(historyPile);
                    futurePile.dataset.cardData = JSON.stringify(currentFuture);
                    updateStackIndicator(futurePile);
                }
            }

            if (currentFuture.length > 0) {
                const card = currentFuture.pop();
                futurePile.dataset.cardData = JSON.stringify(currentFuture);
                updateStackIndicator(futurePile);

                // Duality rule: a destroyed Landmark cycles through History/Future and
                // rebuilds itself — a drawn Landmark goes straight back into the owner's
                // Landmark Zone, not the hand (falls to hand only if the zone is full or
                // a duplicate is already in play).
                const rebuildSlot = card.type === 'Landmark' ? landmarkRebuildSlot(pNum, card) : null;
                if (rebuildSlot) {
                    if (targetSlot.classList.contains('temporary-slot')) targetSlot.remove();
                    animateCardDeal(futurePile, rebuildSlot, card);
                    setTimeout(() => {
                        finishSingleCardPlacement(rebuildSlot, card);
                        floatValue(rebuildSlot, 'Rebuilt', 'gain');
                    }, 650);
                } else {
                    updateHandLayout(pNum);
                    animateCardDeal(futurePile, targetSlot, card);
                    setTimeout(checkHandLimit, 650);
                }
            }

            // Wait for card animation to finish before next draw
            await new Promise(r => setTimeout(r, 500));
        }

        // Gravitas (Duality L1): whenever your History Pile is shuffled into a new
        // Future Pile, draw Cards until you reach your Hand Limit. Resolved after the
        // pending draws land so the deficit is measured against the final hand.
        if (reshuffled) await resolveGravitasRefill(pNum);
    }

    // Where a drawn Landmark rebuilds itself: the first empty slot in its owner's
    // Landmark Zone — or nowhere (null) if the zone is full or a copy is already in play.
    function landmarkRebuildSlot(pNum, card) {
        const board = document.getElementById(`player-${pNum}`);
        if (!board) return null;
        const slots = Array.from(board.querySelectorAll('.landmark-zone-main .card'));
        const duplicate = slots.some(s => {
            if (s.classList.contains('slot-empty')) return false;
            try { return JSON.parse(s.dataset.cardData).name === card.name; } catch (e) { return false; }
        });
        if (duplicate) return null;
        return slots.find(s => s.classList.contains('slot-empty')) || null;
    }

    // Gravitas — counts the hand after the in-flight deal animations settle (a dealt
    // slot only fills ~600ms after its flight starts, and the draw loop waits 500ms),
    // then pulses the landmark and draws the missing cards. Hand Limit is read live
    // via getMaxHand, so Pandorama's +2 raises the refill target too.
    async function resolveGravitasRefill(pNum) {
        if (!findLandmark(pNum, 'Gravitas')) return;
        await new Promise(r => setTimeout(r, 400));

        const board = document.getElementById(`player-${pNum}`);
        if (!board) return;
        const handSlots = Array.from(board.querySelectorAll('.hand-slot'));
        const occupied = handSlots.filter(s => !s.classList.contains('slot-empty')).length;
        const deficit = getMaxHand(board) - occupied;
        if (deficit <= 0) return;

        const landmark = pulseLandmark(pNum, 'Gravitas');
        if (landmark) floatValue(landmark, `Draw ${deficit}`, 'gain');
        await drawCards(pNum, deficit);
    }

    function shuffleArray(array) {
        let currentIndex = array.length, randomIndex;
        while (currentIndex != 0) {
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex--;
          [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    }

    function consolidateHand(playerNum) {
        const board = document.getElementById(`player-${playerNum}`);
        if (!board) return;
        
        const handSlots = Array.from(board.querySelectorAll('.hand-slot'));
        const handContainer = board.querySelector('.hand-slots');
        const cards = [];
        
        // 1. Collect all non-empty cards from current slots
        handSlots.forEach(slot => {
            if (!slot.classList.contains('slot-empty') && slot.dataset.cardData) {
                cards.push(JSON.parse(slot.dataset.cardData));
            }
        });

        // 2. Clear all slots
        handSlots.forEach(slot => {
            slot.classList.add('slot-empty');
            slot.style.backgroundImage = '';
            slot.style.backgroundColor = '';
            slot.textContent = '';
            delete slot.dataset.cardData;
        });

        // 3. Re-populate from the left
        cards.forEach((card, i) => {
            let slot = handSlots[i];
            if (!slot) {
                // If we have more cards than slots, create a temporary one
                slot = createSlot('hand');
                slot.classList.add('temporary-slot');
                handContainer.appendChild(slot);
            }
            slot.classList.remove('slot-empty');
            slot.dataset.cardData = JSON.stringify(card);

            const art = cardArtUrl(card);
            if (art) {
                slot.style.backgroundImage = `url('${art}')`;
                slot.style.backgroundColor = 'transparent';
                slot.textContent = '';
            } else {
                slot.style.backgroundImage = '';
                slot.style.backgroundColor = 'rgba(255,255,255,0.1)';
                slot.textContent = card.name;
            }
            bindHoverToElement(slot, card);
            updateCreatureVisuals(slot);
        });

        // 4. Cleanup: Remove any empty temporary slots (keeping the standard 5)
        const updatedSlots = Array.from(board.querySelectorAll('.hand-slot'));
        for (let i = updatedSlots.length - 1; i >= 5; i--) {
            if (updatedSlots[i].classList.contains('slot-empty') && updatedSlots[i].classList.contains('temporary-slot')) {
                updatedSlots[i].remove();
            }
        }

        updateHandLayout(playerNum);
    }

    function updateHandLayout(playerNum) {
        const board = document.getElementById(`player-${playerNum}`);
        if (!board) return;
        
        // --- Card Effect: Pandorama ---
        let handLimitBoost = 0;
        const landmarkSlots = board.querySelectorAll('.landmark-zone-main .card:not(.slot-empty)');
        landmarkSlots.forEach(slot => {
            try {
                const data = JSON.parse(slot.dataset.cardData);
                if (data.name === 'Pandorama') {
                    handLimitBoost += 2;
                }
            } catch(e) {}
        });

        const handSlots = Array.from(board.querySelectorAll('.hand-slot'));
        const activeLimit = 5 + handLimitBoost;
        
        // Calculate the total number of slots that NEED to be shown (limit slots + any occupied overflow slots)
        const visibleSlots = handSlots.filter((slot, index) => index < activeLimit || !slot.classList.contains('slot-empty'));
        const totalDisplayedCount = visibleSlots.length;

        handSlots.forEach((slot, index) => {
            const isVisible = index < activeLimit || !slot.classList.contains('slot-empty');
            
            if (isVisible) {
                slot.classList.remove('hidden-slot');
                slot.style.setProperty('--fan-total', totalDisplayedCount);
                slot.style.setProperty('--fan-index', index);
            } else {
                slot.classList.add('hidden-slot');
            }
            
            // Re-apply classes for CSS effects (s1, s2, etc.)
            for (let i = 1; i <= 20; i++) slot.classList.remove(`s${i}`);
            slot.classList.add(`s${index + 1}`);
        });

        // Update card count display for inactive boards
        const countLabel = board.querySelector('.hand-card-count');
        if (countLabel) {
            const occupiedCount = handSlots.filter(s => !s.classList.contains('slot-empty')).length;
            if (countLabel.textContent !== String(occupiedCount)) {
                countLabel.textContent = occupiedCount;
                countLabel.classList.remove('pulse-update');
                void countLabel.offsetWidth; // restart the pulse animation
                countLabel.classList.add('pulse-update');
            }
            syncMiniHandFan(board, occupiedCount);
        }

        checkHandLimit();
    }

    function finishTurn() {
        cancelGrab();
        const nextP = (currentPlayer % activePlayerCount) + 1;
        
        // If we full-cycled back to Player 1, increment total turns
        if (nextP === 1) {
            totalTurns++;
        }

        currentPlayer = nextP;
        currentPhase = 0;
        turnSkipped = false;
        steamBoughtThisTurn = false;
        planetariumStaged = 0;
        planetariumUsedThisTurn = false;
        lethargoActive = false;
        lethargoOnlyTP = false;
        lethargoUsedThisPhase = false;
        disarmCloneFactory();
        closeLandmarkContext();
        activeStrDebuff = 0;
        cellShieldDefender = null;
        aetherlabUsedThisPhase = false;
        deactivateAetherlab();
        resetHyperscopeTurnDamage();
        minesUsedThisPhase = false;
        resetLooper();

        const hint = document.getElementById('next-player-hint');
        if (hint) hint.textContent = `To Player ${currentPlayer}`;
        
        const label = document.getElementById('active-player-label');
        if (label) label.textContent = `PLAYER ${currentPlayer}`;
        
        const gameField = document.getElementById('game-field');
        if (gameField) {
            gameField.className = `players-${activePlayerCount} turn-p${currentPlayer}`;
        }

        // Reset all boards active-player class
        document.querySelectorAll('.player-zone').forEach(z => z.classList.remove('active-player'));
        const activeBoard = document.getElementById(`player-${currentPlayer}`);
        if (activeBoard) activeBoard.classList.add('active-player');

        const phaseDisplay = document.getElementById('game-phase-display');
        if (phaseDisplay) phaseDisplay.classList.add('hidden');

        if (vsComputer) {
            // Vs Computer: no pass screen, and the view never flips — Player 1
            // stays anchored at the bottom while the Computer plays above.
            // Player 1's board keeps the .active-player class throughout so the
            // Computer's hand is only ever shown as card backs.
            if (gameField) gameField.className = `players-${activePlayerCount} turn-p1`;
            document.querySelectorAll('.player-zone').forEach(z => z.classList.remove('active-player'));
            const p1Board = document.getElementById('player-1');
            if (p1Board) p1Board.classList.add('active-player');
            if (label) {
                label.textContent = currentPlayer === AI_PLAYER ? 'COMPUTER' : 'PLAYER 1';
                label.classList.toggle('ai-active', currentPlayer === AI_PLAYER);
            }
            startTurn();
            if (currentPlayer === AI_PLAYER) beginComputerTurn();
            return;
        }

        const overlay = document.getElementById('pass-device-overlay');
        if (overlay) overlay.classList.remove('hidden');
    }

    function startTurn() {
        const overlay = document.getElementById('pass-device-overlay');
        if (overlay) overlay.classList.add('hidden');
        
        const phaseDisplay = document.getElementById('game-phase-display');
        if (phaseDisplay) phaseDisplay.classList.remove('hidden');
        
        updatePhaseUI();
        if (window.updateBazaarLighting) window.updateBazaarLighting();
        consolidateHand(currentPlayer);
    }

    // ==================== COMPUTER OPPONENT ====================
    // Player 2 can be driven by a built-in opponent ("Computer") at three
    // difficulty levels. The Computer plays through the same engine paths a
    // human uses (pay cost → Bazaar removal → placement → beginAttack →
    // progressPhase), so every rule the engine knows applies to it too.
    //
    // Presentation: the view never flips. Player 1 stays anchored at the
    // bottom; the Computer's hand shows only as a fan of card backs that grows
    // and shrinks. Its moves play out in real time — ghost-card animations on
    // the board plus the live action feed on the right — so watching is
    // optional. The only time the game waits for you is a decision that is
    // yours by the rules: block or take the hit when its creature attacks.
    //
    // V1 scope: the Computer buys Steam, Creatures and Landmarks. Artifacts
    // and Sparks are skipped for now (their effects need interactive
    // targeting); it still answers Dark Matter, Threat and Talisman prompts.

    const AI_PLAYER = 2;
    let vsComputer = true;
    let aiLevel = 'normal';
    let aiTurnInProgress = false;
    let aiDriving = false; // true only while the Computer itself calls progressPhase

    const AI_PROFILES = {
        easy:   { pace: 1300, buyChance: 0.55, maxBuys: 1 },
        normal: { pace: 1000, buyChance: 0.9,  maxBuys: 2 },
        hard:   { pace: 800,  buyChance: 1,    maxBuys: 4 }
    };
    const aiProfile = () => AI_PROFILES[aiLevel] || AI_PROFILES.normal;
    const aiSleep = (ms) => new Promise(r => setTimeout(r, ms));
    const aiThink = () => aiSleep(aiProfile().pace + Math.random() * 500);
    const aiBoard = () => document.getElementById(`player-${AI_PLAYER}`);

    // --- Live action feed ---
    const AI_FEED_TAGS = { buy: 'BUY', play: 'PLAY', combat: 'FIGHT', draw: 'DRAW', turn: '', system: 'SYS', info: '•' };

    function aiLog(text, kind = 'info') {
        const list = document.getElementById('ai-feed-list');
        const feed = document.getElementById('ai-feed');
        if (!list || !feed) return;
        feed.classList.remove('hidden');
        const entry = document.createElement('div');
        entry.className = `ai-feed-entry ai-feed-${kind}`;
        const tag = AI_FEED_TAGS[kind] ?? AI_FEED_TAGS.info;
        entry.innerHTML = `<span class="ai-feed-tag">${tag}</span><span>${text}</span>`;
        list.prepend(entry); // newest on top
        requestAnimationFrame(() => entry.classList.add('shown'));
        while (list.childElementCount > 30) list.lastElementChild.remove();
    }

    // Dynamic opponent hand fan — one card back per card in hand.
    function syncMiniHandFan(board, count) {
        const fan = board.querySelector('.hand-fan-icon');
        if (!fan) return;
        const shown = Math.max(0, Math.min(count, 9));
        if (fan.dataset.fanCount == shown) return;
        fan.dataset.fanCount = shown;
        fan.innerHTML = '';
        for (let i = 0; i < shown; i++) {
            const mini = document.createElement('div');
            mini.className = 'mini-card-icon dynamic';
            const spread = (shown - 1) / 2;
            mini.style.transform = `translateX(${(i - spread) * 9}px) rotate(${(i - spread) * 8}deg)`;
            fan.appendChild(mini);
        }
    }

    // Ghost-card flight so the Computer's moves are visible on the board.
    function aiAnimateCard(sourceEl, targetEl, card, faceUp = true) {
        if (!sourceEl || !targetEl) return Promise.resolve();
        const s = sourceEl.getBoundingClientRect();
        const t = targetEl.getBoundingClientRect();
        if ((!s.width && !s.height) || (!t.width && !t.height)) return Promise.resolve();
        const ghost = document.createElement('div');
        ghost.className = 'held-card-ghost ai-ghost tech-font';
        ghost.style.left = s.left + 'px';
        ghost.style.top = s.top + 'px';
        const art = cardArtUrl(card);
        if (!faceUp) {
            ghost.style.backgroundImage = "url('assets/card_back.png')";
        } else if (art) {
            ghost.style.backgroundImage = `url('${art}')`;
        } else {
            ghost.style.backgroundColor = 'rgba(40,40,40,0.9)';
            ghost.style.display = 'flex';
            ghost.style.alignItems = 'center';
            ghost.style.justifyContent = 'center';
            ghost.style.fontSize = '10px';
            ghost.textContent = card.name;
        }
        document.body.appendChild(ghost);
        ghost.offsetHeight;
        ghost.style.transition = 'all 0.65s cubic-bezier(0.2, 0.8, 0.2, 1)';
        ghost.style.left = t.left + 'px';
        ghost.style.top = t.top + 'px';
        return new Promise(res => setTimeout(() => { ghost.remove(); res(); }, 700));
    }

    // --- Reading the Computer's own state ---
    function aiHandCards() {
        return Array.from(aiBoard().querySelectorAll('.hand-slot:not(.slot-empty)')).map(slot => {
            try { return { slot, card: JSON.parse(slot.dataset.cardData) }; } catch (e) { return null; }
        }).filter(Boolean);
    }

    function aiSteamCounts() {
        const counts = { F: 0, G: 0, L: 0 };
        aiHandCards().forEach(({ card }) => {
            if (card.type !== 'Steam') return;
            if (card.number === 'STM1') counts.F++;
            else if (card.number === 'STM2') counts.G++;
            else if (card.number === 'STM3') counts.L++;
        });
        return counts;
    }

    // Same affordability math the Bazaar lighting uses, against an explicit pool.
    function aiCanAfford(cost, steams) {
        if (!cost || cost === '-') return true;
        const need = { F: 0, G: 0, L: 0, A: 0 };
        for (const ch of cost) if (need[ch] !== undefined) need[ch]++;
        let { F, G, L } = steams;
        if (F < need.F || G < need.G || L < need.L) return false;
        return (F - need.F) + (G - need.G) + (L - need.L) >= need.A;
    }

    // Pay a cost by moving matching Steam from the Computer's (hidden) hand to
    // History. Mirrors autoPayCost, minus the on-screen animation — the source
    // slots aren't visible, so a ghost flight would start from nowhere.
    function aiPayCost(card) {
        if (!card.cost || card.cost === '-') return;
        const board = aiBoard();
        const historySlot = board.querySelector('.history-pile');
        if (!historySlot) return;
        const pool = aiHandCards().filter(h => h.card.type === 'Steam');
        const used = new Set();
        const matches = (ch, c) =>
            (ch === 'F' && c.number === 'STM1') ||
            (ch === 'G' && c.number === 'STM2') ||
            (ch === 'L' && c.number === 'STM3') ||
            (ch === 'A' && ['STM1', 'STM2', 'STM3'].includes(c.number));
        // Colored pips first so an 'A' never steals a color that's still needed.
        const chars = card.cost.split('').sort((a, b) => (a === 'A') - (b === 'A'));
        for (const ch of chars) {
            const hit = pool.find(h => !used.has(h) && matches(ch, h.card));
            if (!hit) return; // can't satisfy — caller checked affordability first
            used.add(hit);
        }
        used.forEach(h => {
            clearSlot(h.slot);
            finishSingleCardPlacement(historySlot, h.card);
        });
        updateHandLayout(AI_PLAYER);
    }

    function bazaarTop(loc) {
        const pile = (activeBazaar[loc] || []).filter(c => selectedSets.includes(c.set));
        return pile.length ? pile[pile.length - 1] : null;
    }
    const bazaarElFor = (loc) => document.querySelector(`.bazaar-area .card[data-loc="${loc}"]`);

    function removeTopFromBazaar(loc, card) {
        const pile = activeBazaar[loc];
        const idx = pile ? pile.findIndex(c => c.name === card.name) : -1;
        if (idx !== -1) pile.splice(idx, 1);
        renderBazaar();
        if (window.updateBazaarLighting) window.updateBazaarLighting();
    }

    function aiFirstEmptyHandSlot() {
        const board = aiBoard();
        let slot = board.querySelector('.hand-slot.slot-empty');
        if (!slot) {
            slot = createSlot('hand');
            slot.classList.add('temporary-slot');
            board.querySelector('.hand-slots').appendChild(slot);
        }
        return slot;
    }

    function aiOwnsLandmark(name) {
        return Array.from(aiBoard().querySelectorAll('.landmark-zone-main .card:not(.slot-empty)')).some(s => {
            try { return JSON.parse(s.dataset.cardData).name === name; } catch (e) { return false; }
        });
    }

    // --- Decision making ---
    function aiScoreCard(card) {
        const pips = (card.cost || '').replace('-', '').length;
        if (card.type === 'Creature') {
            const hp = parseInt(card.health);
            let score = (Number.isNaN(hp) ? 2 : hp) * 12 + pips * 2;
            const hasCreature = aiHandCards().some(h => h.card.type === 'Creature') ||
                aiBoard().querySelector('.creature-zone-main .card:not(.slot-empty)');
            if (!hasCreature) score += 20; // never sit without a body on the board
            return score;
        }
        // Landmarks: passive effects the Computer benefits from automatically rank higher.
        let score = pips * 9;
        if (card.name === 'Pandorama' || card.name === 'Fountain of Youth') score += 14;
        return score;
    }

    function aiConstructionCandidates() {
        const steams = aiSteamCounts();
        const board = aiBoard();
        const maxHand = getMaxHand(board);
        const handCount = aiHandCards().length;
        const hasEmptyLandmarkSlot = !!board.querySelector('.landmark-zone-main .card.slot-empty');
        const locs = ['L1','L2','L3','L4','L5','L6','L7','L8','C1','C2','C3','C4','C5','C6','C7','C8'];
        const list = [];
        for (const loc of locs) {
            const card = bazaarTop(loc);
            if (!card) continue;
            if (card.type === 'Landmark' && (!hasEmptyLandmarkSlot || aiOwnsLandmark(card.name))) continue;
            if (card.type === 'Creature' && handCount >= maxHand) continue;
            if (!aiCanAfford(card.cost, steams)) continue;
            list.push({ loc, card, score: aiScoreCard(card) });
        }
        return list.sort((a, b) => b.score - a.score);
    }

    function aiChooseSteamBuy() {
        const steams = aiSteamCounts();
        const options = [];
        const fire = bazaarTop('ST1');
        const gold = bazaarTop('ST2');
        const laser = bazaarTop('ST3');
        if (fire) options.push({ loc: 'ST1', card: fire, rank: 1 });
        if (gold && aiCanAfford(gold.cost, steams)) options.push({ loc: 'ST2', card: gold, rank: 2 });
        if (laser && aiCanAfford(laser.cost, steams)) options.push({ loc: 'ST3', card: laser, rank: 3 });
        if (!options.length) return null;

        if (aiLevel === 'easy') {
            if (Math.random() < 0.15) return null; // sometimes forgets the Steam Phase entirely
            return options[Math.floor(Math.random() * options.length)];
        }
        // Normal/Hard: an upgrade buy spends the same Steam a good Construction
        // buy needs this turn — if one is already lined up, take the free Fire.
        const bestBuild = aiConstructionCandidates()[0];
        if (bestBuild && bestBuild.score >= 30) {
            return options.find(o => o.rank === 1) || null;
        }
        options.sort((a, b) => b.rank - a.rank);
        return options[0];
    }

    // --- Executing moves ---
    async function aiBuyFromBazaar(loc, card) {
        const src = bazaarElFor(loc);
        const cardCopy = { ...card };
        let targetEl, place, logText, logKind;

        if (cardCopy.type === 'Landmark') {
            const slot = aiBoard().querySelector('.landmark-zone-main .card.slot-empty');
            if (!slot) return;
            targetEl = slot;
            place = () => finishSingleCardPlacement(slot, cardCopy);
            logText = `Builds ${cardCopy.name}`;
            logKind = 'play';
        } else {
            // Steam and Creatures go to the hand — the flight lands on the card-back fan.
            targetEl = aiBoard().querySelector('.inactive-hand-display') || aiBoard();
            place = () => {
                finishSingleCardPlacement(aiFirstEmptyHandSlot(), cardCopy);
                updateHandLayout(AI_PLAYER);
            };
            logText = `Buys ${cardCopy.name}`;
            logKind = 'buy';
        }

        aiPayCost(cardCopy);
        removeTopFromBazaar(loc, cardCopy);
        if (cardCopy.type === 'Steam') steamBoughtThisTurn = true;
        const costTxt = cardCopy.cost && cardCopy.cost !== '-' ? ` (${cardCopy.cost})` : '';
        aiLog(logText + costTxt, logKind);
        await aiAnimateCard(src, targetEl, cardCopy, true);
        place();
    }

    async function aiCreaturePhase() {
        const board = aiBoard();

        // 1) Summon: strongest Creature in hand into an empty zone slot (one per turn).
        const emptyZone = board.querySelector('.creature-zone-main .card.slot-empty');
        const creaturesInHand = aiHandCards().filter(h => h.card.type === 'Creature');
        if (emptyZone && creaturesInHand.length) {
            creaturesInHand.sort((a, b) => (parseInt(b.card.health) || 0) - (parseInt(a.card.health) || 0));
            const pick = creaturesInHand[0];
            const data = { ...pick.card };
            clearSlot(pick.slot);
            updateHandLayout(AI_PLAYER);
            aiLog(`Summons ${data.name}${data.health ? ` — ${data.health} HP` : ''}`, 'play');
            await aiAnimateCard(board.querySelector('.inactive-hand-display'), emptyZone, data, true);
            finishSingleCardPlacement(emptyZone, data);
            await aiThink();
        }

        // 2) Attack with every Creature that's allowed to act.
        const zoneSlots = Array.from(board.querySelectorAll('.creature-zone-main .card:not(.slot-empty)'));
        for (const slot of zoneSlots) {
            if (gameWon) return;
            let data;
            try { data = JSON.parse(slot.dataset.cardData); } catch (e) { continue; }
            const canAct = (data.summonedOnTurn < totalTurns) || data.name.includes('Cravus') || data.name.includes('Rampadon');
            if (!canAct || data.deactivated || data.type !== 'Creature') continue;
            if (calculateCurrentStrength(data, slot) <= 0 && !data.name.includes('Entrophy')) continue;
            aiLog(`${data.name} attacks you!`, 'combat');
            beginAttack(data, slot, 1);
            await aiWaitForCombat();
            await aiThink();
        }
    }

    // Wait until all combat UI (defense screen, Entrophy wheel, Threat choice)
    // has been resolved and closed — the human decides blocks at their own pace.
    async function aiWaitForCombat() {
        const combatOpen = () => {
            const d = document.getElementById('defense-overlay');
            return (d && !d.classList.contains('hidden')) ||
                !!document.querySelector('.entrophy-overlay') ||
                !!document.querySelector('.landmark-choice-overlay');
        };
        await aiSleep(700);
        while (combatOpen()) await aiSleep(300);
        await aiSleep(300);
    }

    function aiAdvancePhase() {
        aiDriving = true;
        try { progressPhase(); } finally { aiDriving = false; }
    }

    // --- The Computer's full turn ---
    async function beginComputerTurn() {
        if (aiTurnInProgress || gameWon || !vsComputer || !gameStarted) return;
        aiTurnInProgress = true;
        document.body.classList.add('ai-turn');
        aiLog("Computer's turn", 'turn');
        try {
            await aiThink();

            // Steam Phase — up to one Steam purchase (free FireSteam included).
            if (!gameWon) {
                const steamPick = aiChooseSteamBuy();
                if (steamPick) await aiBuyFromBazaar(steamPick.loc, steamPick.card);
                else aiLog('Skips its Steam buy', 'info');
            }
            await aiThink();
            aiAdvancePhase(); // → Construction

            // Construction Phase — buy per difficulty profile.
            const prof = aiProfile();
            let buys = 0;
            while (buys < prof.maxBuys && !gameWon) {
                if (Math.random() > prof.buyChance) break;
                const candidates = aiConstructionCandidates();
                if (!candidates.length) break;
                const choice = aiLevel === 'easy'
                    ? candidates[Math.floor(Math.random() * candidates.length)]
                    : candidates[0];
                await aiBuyFromBazaar(choice.loc, choice.card);
                buys++;
                await aiThink();
            }
            aiAdvancePhase(); // → Creature
            await aiThink();

            if (!gameWon) await aiCreaturePhase();

            aiAdvancePhase(); // → End (draws 2 automatically)
            if (!gameWon) {
                aiLog('Draws 2 cards', 'draw');
                await aiSleep(3000); // covers both deal animations plus a possible reshuffle
                if (!canEndTurn()) {
                    aiLog('Discards down to the hand limit', 'info');
                    aiAdvancePhase(); // auto-discards the cheapest, stays in End Phase
                    await aiSleep(800);
                }
                aiAdvancePhase(); // → finishTurn, back to Player 1
            }
        } finally {
            aiTurnInProgress = false;
            document.body.classList.remove('ai-turn');
        }
        if (!gameWon) aiLog('Your turn', 'turn');
    }

    // --- Reactions to the human's plays ---
    function aiChooseBlocker(attackerStr, availableCreatures, isUnblockable) {
        if (isUnblockable || !availableCreatures.length) return null;
        const options = availableCreatures.map(slot => {
            let c;
            try { c = JSON.parse(slot.dataset.cardData); } catch (e) { return null; }
            if (c.deactivated || c.type !== 'Creature') return null; // asleep cards can't block
            const res = (parseInt(c.baseResistance ?? c.baseHealth ?? c.resistance ?? c.health) || 0) + cabinBonus(slot.closest('.player-zone')) - (c.damageTaken || 0);
            return { slot, name: c.name, res };
        }).filter(Boolean);
        if (!options.length) return null;

        if (aiLevel === 'easy') {
            return Math.random() < 0.5 ? options[Math.floor(Math.random() * options.length)] : null;
        }

        const myTP = totalTimePoints(AI_PLAYER);
        // Cheapest wall that survives the hit.
        const survivors = options.filter(o => o.res > attackerStr).sort((a, b) => a.res - b.res);
        if (survivors.length) return survivors[0];
        // Even trade: worth it against real damage.
        const trade = options.find(o => o.res === attackerStr);
        if (trade && attackerStr >= (aiLevel === 'hard' ? 2 : 3)) return trade;
        // Chump block when the hit is big or threatens the dice.
        const biggest = [...options].sort((a, b) => b.res - a.res)[0];
        if (attackerStr >= myTP) return biggest;
        if (aiLevel === 'hard' && attackerStr >= 4) return biggest;
        return null;
    }

    function aiHandleDefense({ attacker, attackerSlot, availableCreatures, isUnblockable, btnBlock, btnContinue, feedbackEl, defenseOverlay, hyperTarget = null }) {
        defenseOverlay.classList.add('ai-controlled');
        feedbackEl.textContent = 'Computer is deciding…';
        const attackerStr = calculateCurrentStrength(attacker, attackerSlot);

        setTimeout(() => {
            // A Hyperscope-locked target leaves the Computer no block decision to make.
            const choice = hyperTarget ? null : aiChooseBlocker(attackerStr, availableCreatures, isUnblockable);
            if (choice) {
                btnBlock.onclick();
                if (availableCreatures.length > 1) {
                    const pickBtn = Array.from(document.querySelectorAll('#blocker-picker button'))
                        .find(b => b.textContent === choice.name);
                    if (pickBtn) pickBtn.click();
                }
                aiLog(`Blocks with ${choice.name}`, 'combat');
            } else if (hyperTarget && hyperTarget.kind !== 'player') {
                aiLog(`Can't block — Hyperscope strike resolves`, 'combat');
            } else {
                aiLog(isUnblockable ? `Can't block — takes ${attackerStr} damage` : `Takes ${attackerStr} damage`, 'combat');
            }
            setTimeout(() => {
                btnContinue.onclick(); // resolve
                setTimeout(() => {
                    btnContinue.onclick(); // close
                    defenseOverlay.classList.remove('ai-controlled');
                }, 2000);
            }, 900);
        }, 1200);
    }

    function aiHandleDarkMatter({ overlay, btnDisc, btnTp, handCards, feedbackEl }) {
        overlay.classList.add('ai-controlled');
        feedbackEl.textContent = 'Computer is deciding…';
        setTimeout(() => {
            let pickName = null;
            if (handCards.length) {
                const ranked = handCards.map(s => {
                    let c;
                    try { c = JSON.parse(s.dataset.cardData); } catch (e) { c = {}; }
                    return { name: c.name, val: cardCostValue(c) };
                }).sort((a, b) => a.val - b.val);
                // Shed a cheap card (Fire/AllSteam tier) rather than pay Time Points;
                // pay TP instead of discarding anything Gold-tier or better while healthy.
                if (ranked[0].val < 1e4 || totalTimePoints(AI_PLAYER) <= 8) pickName = ranked[0].name;
            }
            if (pickName) {
                aiLog(`Dark Matter: discards ${pickName}`, 'combat');
                btnDisc.onclick();
                setTimeout(() => {
                    const pickBtn = Array.from(document.querySelectorAll('#dm-picker button'))
                        .find(b => b.textContent === pickName);
                    if (pickBtn) pickBtn.click();
                    overlay.classList.remove('ai-controlled');
                }, 400);
            } else {
                aiLog('Dark Matter: loses 2 Time Points', 'combat');
                btnTp.onclick();
                overlay.classList.remove('ai-controlled');
            }
        }, 1300);
    }

    function aiHandleThreat({ overlay, btnPay, btnDecline, canPay, cost, cardName }) {
        overlay.classList.add('ai-controlled');
        setTimeout(() => {
            const keep = canPay && cost <= 4 && (totalTimePoints(AI_PLAYER) - cost) >= 8;
            if (keep) {
                aiLog(`Pays ${cost} TP to keep ${cardName}`, 'combat');
                btnPay.onclick();
            } else {
                aiLog(`Lets ${cardName} fall to the Abyss`, 'combat');
                btnDecline.onclick();
            }
        }, 1300);
    }

    // --- Options wiring & persistence ---
    (function initOpponentControls() {
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem('futoryOpponent') || '{}'); } catch (e) {}
        if (typeof saved.vsComputer === 'boolean') vsComputer = saved.vsComputer;
        if (saved.level && AI_PROFILES[saved.level]) aiLevel = saved.level;

        const oppButtons = document.querySelectorAll('#opponent-toggle .toggle-btn');
        const diffRow = document.getElementById('difficulty-row');
        const diffButtons = document.querySelectorAll('#difficulty-toggle .toggle-btn');

        const syncUI = () => {
            oppButtons.forEach(b => b.classList.toggle('active', (b.dataset.opponent === 'computer') === vsComputer));
            diffButtons.forEach(b => b.classList.toggle('active', b.dataset.difficulty === aiLevel));
            if (diffRow) diffRow.classList.toggle('hidden', !vsComputer);
            const feed = document.getElementById('ai-feed');
            if (feed) feed.classList.toggle('hidden', !vsComputer);
        };
        const persist = () => localStorage.setItem('futoryOpponent', JSON.stringify({ vsComputer, level: aiLevel }));

        oppButtons.forEach(b => b.addEventListener('click', () => {
            vsComputer = b.dataset.opponent === 'computer';
            persist();
            syncUI();
            if (!vsComputer) return;
            aiLog(`Computer opponent ready — ${aiLevel}`, 'system');
            // If the pass screen is already waiting on Player 2, take over now.
            const passOverlay = document.getElementById('pass-device-overlay');
            if (gameStarted && currentPlayer === AI_PLAYER && passOverlay && !passOverlay.classList.contains('hidden') && !aiTurnInProgress) {
                passOverlay.classList.add('hidden');
                const gf = document.getElementById('game-field');
                if (gf) gf.className = `players-${activePlayerCount} turn-p1`;
                document.querySelectorAll('.player-zone').forEach(z => z.classList.remove('active-player'));
                document.getElementById('player-1')?.classList.add('active-player');
                const label = document.getElementById('active-player-label');
                if (label) { label.textContent = 'COMPUTER'; label.classList.add('ai-active'); }
                startTurn();
                beginComputerTurn();
            }
        }));

        diffButtons.forEach(b => b.addEventListener('click', () => {
            aiLevel = b.dataset.difficulty;
            persist();
            syncUI();
            if (vsComputer) aiLog(`Difficulty set to ${aiLevel}`, 'system');
        }));

        const feedHeader = document.getElementById('ai-feed-header');
        if (feedHeader) feedHeader.addEventListener('click', () => {
            document.getElementById('ai-feed')?.classList.toggle('collapsed');
        });

        syncUI();
    })();

    // --- Game Over Button Handlers ---
    if (btnPlayAgain) {
        btnPlayAgain.addEventListener('click', () => {
            gameOverOverlay.classList.add('hidden');
            // Complete reset: Re-initialize player states and boards
            gameStarted = false;
            for (let i = 1; i <= 4; i++) {
                if (playersState[i]) {
                    playersState[i].day = 12;
                    playersState[i].night = 12;
                    playersState[i].activeDie = 'day';
                    updateActiveDieGlow(i);
                    rhoneCharge[i] = 0;
                }
            }
            initAllActiveBoards();
        });
    }

    if (btnBackMenu) {
        btnBackMenu.addEventListener('click', () => {
            window.location.reload(); // Returns to fresh start/menu state
        });
    }

    if (btnStats) {
        btnStats.addEventListener('click', () => {
            alert('Stats coming soon! Tracking damage per player...');
        });
    }

    if (btnCloseOverlay) {
        btnCloseOverlay.addEventListener('click', () => {
            gameOverOverlay.classList.add('hidden');
        });
    }

    setupTurnControl();
    initAllActiveBoards(); // Initial spawn
});
