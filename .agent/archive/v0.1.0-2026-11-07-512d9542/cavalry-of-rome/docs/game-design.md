# Cavalry of Rome — Game Design Notes

## One-Sentence Promise

Command a Roman auxiliary cavalry wing, read the battlefield lanes, choose the right formation, and break the enemy line before morale and cohesion collapse.

## Core Verb

**Command cavalry.**

The player does not directly steer one rider. The player issues tactical commands:

```txt
select lane
choose formation
charge
rally
restart
```

## Core Loop

```txt
Observe enemy lanes.
Choose target lane.
Choose formation.
Commit charge.
Resolve impact.
Rally or redirect.
Break every lane or collapse.
Repeat.
```

## Formation Intent

| Formation | Purpose | Tradeoff |
|---|---|---|
| Line | Balanced default | No extreme benefit |
| Wedge | Strongest impact | Higher cohesion and fatigue cost |
| Screen | Preserves cohesion | Lower impact |

## Win / Loss

Win when all three enemy lanes are routed.

Lose when Roman morale, cohesion, or trooper count reaches zero.

## Expansion Candidates

- Terrain-specific lane modifiers.
- Enemy commander reactions.
- Trumpet command cooldowns.
- Replay-safe campaign reward ledger.
- Scout/harass pre-charge phase.
- Scenario sequence graph for campaign missions.
