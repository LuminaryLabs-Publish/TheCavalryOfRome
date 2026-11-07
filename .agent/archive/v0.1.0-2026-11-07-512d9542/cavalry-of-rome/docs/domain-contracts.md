# Cavalry of Rome — Domain Contracts

## Primary Domain

```txt
cavalry-command-domain
```

The current implementation is `cavalry-of-rome-kit`, a game-specific kit that can later be split into generic domain kits.

## Resource

```txt
cavalryOfRome.state
```

Durable state includes:

```txt
mode
formation
selectedLane
targetLane
player morale/cohesion/fatigue/troopers/momentum
enemy lane strength/morale/distance/status
sequence hint state
command log
diagnostics
```

## Commands / Events

| Event | Meaning |
|---|---|
| `cavalry.formation.requested` | Player requests a formation change. |
| `cavalry.lane.selected` | Player selects an enemy lane. |
| `cavalry.charge.requested` | Player requests a charge. |
| `cavalry.charge.started` | Kit accepted and started a charge. |
| `cavalry.impact.resolved` | Charge reached impact and damage was resolved. |
| `cavalry.rally.requested` | Player requests rally. |
| `cavalry.enemy.routed` | One enemy lane routed. |
| `cavalry.battle.completed` | All enemy lanes routed. |
| `cavalry.battle.failed` | Roman unit collapsed. |
| `cavalry.command.rejected` | Command failed validation. |
| `cavalry.restart.requested` | Scenario reset requested. |

## Validation Rules

```txt
Unknown formations reject.
Unknown lanes reject.
Routed lanes cannot be selected.
Cannot redirect during committed charge.
Cannot charge with low cohesion or morale.
Cannot rally during charge.
Rally has a cooldown.
No tactical commands after victory/defeat except restart.
```

## Promotion Path

The game-specific kit can later split into reusable kits:

```txt
formation-command-kit
morale-cohesion-kit
charge-resolution-kit
enemy-lane-pressure-kit
battle-objective-kit
```

Each split should preserve headless tests and keep the renderer out of the simulation.
