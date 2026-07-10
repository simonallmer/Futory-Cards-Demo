# FUTORY CARDS — DEVELOPER PLAN

> **For AI agents and developers:** This document gives full context on the Futory Cards digital project. Read this before touching any code. Last updated: 2026-05-28.

---

## 1. Project Overview

**Project:** Futory Cards Digital (Web App)
**Creator:** Simon Allmer / Simon Allmer Entertainment
**Stack:** Vanilla HTML + CSS + JavaScript (no framework, no build step)
**Entry point:** `index.html` — single-page app, served via GitHub Pages
**Mode:** Pass-and-play (2–4 players share one device)
**Focus:** Unity (set 1) is the current implementation target. Duality (set 2) is in design/balancing. Trinity (set 3) planned for 2028.

---

## 2. Game Overview

Futory Cards is a deck-building card game series of three standalone sets that can be combined:

| Set | Cards | Physical | Digital Status |
|-----|-------|----------|----------------|
| Unity | 001–048 | Released | In progress |
| Duality | 049–096 | Not released (balancing) | Partial data, no images yet |
| Trinity | 097+ | Planned 2028 | Placeholder only |

**Win condition:** Last player standing. A player is eliminated when both their Day Die and Night Die reach 0.

---

## 3. Card Types

| Type | Played to | Cost | Bazaar copies |
|------|-----------|------|---------------|
| Steam | Hand | Special (see below) | 10 |
| Landmark | Landmark Zone (permanent) | Steam | 3 |
| Creature | Creature Zone → History after combat | Steam | Rarity-based |
| Artifact | History Pile (used reactively in response) | Steam | Rarity-based |
| Spark | Abyss (one-time use) | Steam | 6 |
| Destiny | Destiny Abyss (or Destiny Zone if persistent) | Free (triggered) | 1 |

---

## 4. Core Mechanics

### 4.1 Time Points (TP)

Each player tracks TP via two independent dice:
- **Day Die** (orange): starts at 12
- **Night Die** (blue): starts at 12

Total starting TP = 24. Incoming damage drains Day Die first, then Night Die once Day reaches 0. A die at 0 cannot be recovered — it stays at 0 even if TP would be gained. Elimination occurs when both dice reach 0.

### 4.2 Steam Currency

Three tiers, hierarchical value:

| Steam | Symbol | Purchase cost from Bazaar | Notes |
|-------|--------|--------------------------|-------|
| FireSteam | F | Free | Only free card in the game |
| GoldSteam | G | AAA (3 of any Steam) | |
| LaserSteam | L | FGG (1 Fire + 2 Gold from hand) | |

- **AllSteam (A)**: Any Steam can count as A when paying costs.
- Limit: **1 Steam purchase per turn** (regardless of type). You cannot buy FireSteam and use it in the same turn to buy LaserSteam.
- Steams paid as cost go to History Pile, not back to Bazaar (except Aetherlab trade — see below).

### 4.3 The Bazaar

Central 4-row marketplace, columns are fixed locations:

```
Row 0 (special): [empty] | Abyss | FireSteam | GoldSteam | LaserSteam | Destiny Pile | Destiny Abyss | [empty]
Row 2 (Landmarks): L1 | L2 | L3 | L4 | L5 | L6 | L7 | L8
Row 3 (Creatures):  C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8
Row 4 (A+S):        A1 | A2 | A3 | A4 | S1 | S2 | S3 | S4
```

When using multiple sets, cards from each set occupy the same location slots and stack into piles. Players can see the top card and browse the stack via the location modal.

### 4.4 Turn Structure

Each player's turn consists of 4 mandatory phases in order:

**Phase 0 — Steam Phase**
- Take 1 Steam card from Bazaar into hand, OR skip.
- Skipping grants: draw 3 cards in End Phase (instead of 2) + Fountain of Youth +1 TP bonus (if active).

**Phase 1 — Construction Phase**
- Play Landmarks from hand to your Landmark Zone.
- Play Artifacts from hand directly to your History Pile (they become reactive).
- Play Spark cards from hand (resolve effect, goes to Abyss).
- Purchase non-Steam cards from Bazaar by paying their cost in Steam from hand.

**Phase 2 — Creature Phase**
- Summon Creatures from hand to your Creature Zone.
- Attack with Creatures (see Combat below).
- Newly summoned creatures have summoning sickness (cannot attack turn they enter), unless they have "instant attack" stated on the card.

**Phase 3 — End Phase**
- Draw 2 cards from Future Pile into hand (3 if Steam Phase was skipped).
- If Future Pile is empty when drawing, shuffle History Pile to form new Future Pile first.
- Discard down to hand limit (default 5) before ending turn. Turn cannot end while over limit.

### 4.5 Starting Deck & Game Start

Each player starts with: **5× FireSteam, 2× GoldSteam, 1× Ichor**, shuffled as Future Pile.
Deal **3 cards** to each player's hand before the first turn.

### 4.6 Hand Limit

Default: **5 cards**. Pandorama Landmark increases it by +2.

### 4.7 Destiny Cards

- Triggered at the **very start of a player's turn** if their Future Pile has **exactly 0 cards** (before any phases, including before shuffle-on-draw).
- The active player draws one Destiny card from the Destiny Pile and resolves it.
- **Instant** Destiny cards: Resolve effect, then go to **Destiny Abyss** (slot DA).
- **Semi-permanent**: Placed on a Bazaar pile or location as indicated by the card.
- **Permanent**: Placed in the **Destiny Zone** (above the Bazaar) and remain for the rest of the game. Should be shown in a contextual HUD.
- When Destiny Pile is exhausted, no further Destiny cards trigger.

### 4.8 Combat

1. Active player selects a creature (Creature Phase only, no summoning sickness).
2. Attack menu shows — player confirms ATTACK.
3. In 3–4 player games, active player picks a target player.
4. **Defense overlay** appears for defending player:
   - Defending player may **block** with one of their creatures (optional, their choice).
   - Defending player may **play an Artifact** from hand in response.
   - Defending player may choose **direct damage** (no block).
5. Combat resolves:
   - **Direct damage**: Attacker's HP deals that much damage to defender's TP.
   - **With blocker**: Compare Attacker HP vs Blocker HP.
     - Attacker > Blocker: Blocker destroyed, excess damage goes to defender's TP.
     - Attacker < Blocker: Attacker destroyed, Blocker takes damage (HP reduced, survives).
     - Equal: Both destroyed.
6. **Attacker ALWAYS goes to History Pile after combat**, regardless of outcome. (One-use-per-attack design; creatures return via Future Pile cycle.)

### 4.9 Deactivation

Some cards can "deactivate" (turn face-down):
- Deactivated cards cannot use their effects or attack.
- Targeting a deactivated card for deactivation again discards it instead.
- **Sleep Potion** can deactivate a Creature intentionally when summoning, keeping its identity hidden until it attacks.
- Visual: Deactivated card shows face-down (card back side).

---

## 5. File Structure

```
Futory Cards Developer/
├── index.html          — Full game board, all modal HTML
├── cardData.js         — Card data array (cards 001–096 + Steam) + keywordsMap
├── script.js           — All game logic (~3050 lines)
├── styles.css          — All styling
├── FUTORY_PLAN.md      — This document
├── FUTORY_PLAN.pdf     — PDF version of this document
└── assets/
    ├── cards/          — Unity card art images (PNG, slugified filenames)
    ├── *.png           — Steam art, backgrounds, card backs
    └── QuickStartRulesWeb.pdf — Physical rulebook reference
```

**Key JS state variables:**

| Variable | Type | Purpose |
|----------|------|---------|
| `playersState` | Object | `{day, night}` per player |
| `currentPlayer` | int | 1–4 |
| `currentPhase` | int | 0=Steam, 1=Construction, 2=Creature, 3=End |
| `totalTurns` | int | Full rounds completed (for summoning sickness) |
| `activeBazaar` | Object | Card inventory per location |
| `selectedSets` | Array | Active card sets (e.g. `['Unity']`) |
| `heldCards` | Array | Cards currently being dragged |
| `activeStrDebuff` | int | Cumulative Smoke debuff on attackers this turn |

---

## 6. Implementation Status

### 6.1 Core Systems

| System | Status | Notes |
|--------|--------|-------|
| Bazaar rendering | ✅ Done | Single-set shows art; multi-set shows card name text |
| Card purchasing / auto-pay | ✅ Done | Pays leftmost valid Steams from hand |
| Phase progression | ✅ Done | Spacebar shortcut + button |
| Turn rotation (2–4P) | ✅ Done | Pass-device overlay |
| Hand limit + discard enforcement | ✅ Done | Blocks End Turn until compliant |
| Combat (attack/block/direct) | ✅ Done | Single creature can block |
| Spillover damage | ✅ Done | Attacker wins → excess to defender TP |
| Artifact play in defense | ✅ Done | Multi-artifact selection possible |
| Future/History cycling | ✅ Done | Auto-reshuffle with animation |
| Summoning sickness | ✅ Done | Based on `summonedOnTurn` vs `totalTurns` |
| Game over / win detection | ⚠️ Bug | `winnerText` undefined — should be `winnerTitle` |
| Card hover preview | ✅ Done | 750ms hover delay |
| Keyword glossary | ✅ Done | Searchable, categorised |
| Database view | ✅ Done | All cards listed |
| Dev Log / Checklist | ✅ Done | Shows implementation status |
| Bazaar affordability highlight | ✅ Done | Greys out unaffordable cards |
| **Destiny trigger system** | ❌ Not started | See §7 Known Bugs |
| **Deactivation (face-down)** | ❌ Not started | |
| **Defender creature choice** | ❌ Bug | Always picks first creature in zone |
| **Permanent Destiny zone HUD** | ❌ Not started | |

### 6.2 Card Effects — Unity Landmarks

| Card | Status | Notes |
|------|--------|-------|
| Pandorama (001) | ✅ Done | Hand limit +2 |
| Fountain of Youth (002) | ✅ Done | +1 TP when skipping Steam Phase |
| Dragura's Wasteland (003) | ❌ Pending | Discard FireSteam → heal all damage from a Creature |
| Planetarium (004) | ❌ Pending | Description missing from cardData — needs entry |
| Laser Catalyst (005) | ❌ Pending | End Phase: discard LaserSteams → deal 1 dmg each, Artifacts can't respond |
| Lethargo's Temple (006) | ⚠️ Partial | Bazaar dimming works; TP-as-currency payment not implemented |
| Clone Factory (007) | ❌ Pending | Creature Phase: discard GoldSteam → attack twice |
| Aetherlab (008) | ⚠️ Bug | Currently unlocks Steam in Construction; should be a **trade** UI — pay 1 Steam from hand, take next tier from Bazaar (Fire→Gold or Gold→Laser), traded Steam returns to Bazaar pile |

### 6.3 Card Effects — Unity Creatures

| Card | Status | Notes |
|------|--------|-------|
| Ichor (009) | ✅ Done | No special effect; 2 HP |
| Cravus (010) | ✅ Done | No summoning sickness |
| Entrophy (011) | ❌ Pending | On attack: roll die, 6 possible outcomes |
| Meridius (012) | ❌ Pending | +1 Str per opponent Landmark; unblockable if opponent has ≥3 Landmarks |
| Meridia (013) | ⚠️ Partial | HP scales with Artifacts in History ✓; sacrifice-to-prevent-damage not implemented |
| Time Thief (014) | ❌ Pending | Gain TP equal to damage dealt |
| Rampadon (015) | ✅ Done | No summoning sickness + unblockable |
| Vulcanem (016) | ✅ Done | No special effect; 6 HP tank |

### 6.4 Card Effects — Unity Artifacts

| Card | Status | Notes |
|------|--------|-------|
| Smoke (017) | ✅ Done | -1 Str to all attacking creatures per Smoke played; stackable |
| Dark Matter (018) | ❌ Pending | Draw a card; target player chooses: sacrifice Creature / discard Card / lose 2 TP |
| Reflector (019) | ❌ Pending | Redirect attack to a player of your choice |
| Talisman (020) | ❌ Pending | Prevent a card targeting you; Creature/Artifact → History, Spark → Abyss |

### 6.5 Card Effects — Unity Sparks

| Card | Status | Notes |
|------|--------|-------|
| Reversal (021) | ❌ Pending | Take a card from your History Pile to Hand |
| Faith (022) | ❌ Pending | Draw a card; gain 3 TP |
| Threat (023) | ❌ Pending | Send a Landmark to Abyss unless owner pays 2 TP per Landmark they own |
| Confiscation (024) | ❌ Pending | Look at target opponent's hand; take one card |

### 6.6 Destiny Cards (Unity, 025–048)

**Trigger system not yet built.** All 24 Unity Destiny cards are pending. Notable complex ones requiring special logic:

| Card | Type | Notes |
|------|------|-------|
| Freeze (026) | Semi-perm | Turn ends; draw only 1 in End Phase (need flag) |
| Sandstorm (039) | Semi-perm | All Landmarks deactivated; once per Construction reactivate 1 |
| Wormhole (040) | Instant | Everyone shuffles all zones into new Future Pile, draws 3 |
| Contermination (043) | Semi-perm | Turn a non-Steam Bazaar pile face-down (inaccessible) |
| Noctura's Night (044) | Semi-perm | Each player removes their Day Die |
| Royal Privilege (082) | Semi-perm | Place on Bazaar pile to reserve for future purchase |
| Amphion's Fog (086) | Permanent | Can only attack adjacent players for rest of game |
| Lost Souls (088) | Permanent | Defeated players' cards return to Bazaar |
| Chrono Machine (047) | Instant | Active player gets an extra turn |
| Pathways (093) | Permanent | Split Destiny pile into two; players choose which to draw from |

---

## 7. Known Bugs (Confirmed)

| # | Location | Bug | Fix |
|---|----------|-----|-----|
| 1 | script.js ~1510 | `winnerText` used but undefined; should be `winnerTitle` | Rename to `winnerTitle` |
| 2 | script.js ~717 | `getBaseStrength()` uses `parseInt(card.cost)` — costs are strings like "FGL" | Should use `parseInt(card.health)` or `card.baseHealth` |
| 3 | script.js ~2040 | Blocker always picks `availableCreatures[0]`; no defender choice | Add selection UI when multiple creatures in zone |
| 4 | script.js ~1295 | Aetherlab check allows Steam buying during Construction; wrong | Replace with trade UI (pay Steam from hand → get upgraded Steam) |
| 5 | script.js ~1237 | Lethargo's Temple: `canAfford` returns `true` for everything; too permissive | Should allow TP payment: F=1TP, G=2TP, L=3TP, but still check TP availability |

---

## 8. Pending Work — Priority Order

### P1 — Unity Game Completion (immediate)
1. **Fix** `winnerText` → `winnerTitle` bug
2. **Fix** defender creature choice (show selection UI)
3. **Implement** Destiny trigger system (at turn start, Future Pile = 0)
4. **Implement** deactivation state (face-down visual toggle for Landmarks and Creatures)
5. **Implement** remaining Unity card effects (Landmarks, Creatures, Artifacts, Sparks — see tables above)
6. **Fix** Aetherlab to be a trade mechanic
7. **Fix** Lethargo's Temple TP-as-currency payment UI

### P2 — Duality Integration (when Unity is stable)
1. Confirm Duality card costs (many are blank — pending balancing)
2. Add Duality card images as they are produced
3. Implement Duality-specific mechanics:
   - Chrona: Strength/Resistance split (redistribute HP between Attack and Defense)
   - Lotus: Extra Creature slot as Artifact placement
   - Hand of Rhone: Direction + range-based area damage mechanic
   - Hyperscope: Direct-target Landmark destruction
   - Sleep Potion: Intentional face-down creature placement

### P3 — Polish
1. Stats panel (damage dealt per player, turns survived)
2. Permanent Destiny card contextual HUD
3. Multi-Destiny pile mechanic (Pathways card)
4. Automated rule enforcement mode (currently Manual only)

---

## 9. Design Notes & Clarifications (from Simon)

- **Single creature stat**: All creatures use one HP value as both attack and defense (no separate Strength/Health for Unity). Chrona (Duality 057) is the only exception — it splits HP between Strength and Resistance on entry.
- **Creatures are not permanent attackers**: Every attacking creature goes to History after combat regardless of outcome. This is intentional — they cycle back through Future Pile.
- **Blocking is optional**: Defender always chooses whether to block or take direct damage. If Lotus is in play and multiple creatures are available, defender picks which one blocks.
- **FireSteam is the only free card** — no other card has no cost.
- **Steam limit**: 1 Steam per turn from Bazaar, period. You cannot buy Fire then immediately use it to buy Gold/Laser in the same turn.
- **Aetherlab**: Trade mechanic — Construction Phase only. Pay 1 Steam from hand, take the next tier from Bazaar to hand. Traded Steam returns to its Bazaar pile.
- **Fountain of Youth**: Simplified to — skip Steam Phase = +1 TP. No other draw-3 scenario currently.
- **Deactivation** = card turns face-down. Targeting a face-down card for deactivation = discard instead.
- **Destiny trigger** = checked at the very start of a turn (before phases), only if Future Pile is exactly 0. Shuffle happens only when you would draw, not pre-emptively.
- **Duality costs**: TBD — focus on Unity first. Costs will be provided when balancing is complete.
- **Duality images**: Will be added over time as they are produced.
