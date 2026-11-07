export const cavalryOfRomeLevel01 = Object.freeze({
  id: "cavalry-of-rome-level-01",
  title: "Cavalry of Rome: Sabine Road",
  objective: "Break the raider line before Roman morale collapses.",

  player: {
    unitId: "ala-augusta",
    label: "Ala Augusta",
    troopers: 32,
    morale: 78,
    cohesion: 72,
    fatigue: 8
  },

  formations: {
    line: {
      id: "line",
      label: "Line",
      speed: 1.0,
      impact: 1.0,
      cohesionDrain: 0.72,
      defense: 0.95,
      rallyBonus: 1.0,
      description: "Balanced Roman cavalry line."
    },
    wedge: {
      id: "wedge",
      label: "Wedge",
      speed: 0.94,
      impact: 1.35,
      cohesionDrain: 1.14,
      defense: 0.72,
      rallyBonus: 0.8,
      description: "Heavy shock formation for decisive charges."
    },
    screen: {
      id: "screen",
      label: "Screen",
      speed: 1.12,
      impact: 0.74,
      cohesionDrain: 0.45,
      defense: 1.22,
      rallyBonus: 1.25,
      description: "Loose skirmish screen that preserves cohesion."
    }
  },

  lanes: [
    {
      id: "left",
      label: "Left Flank",
      enemyLabel: "Hill Raiders",
      x: 0.23,
      strength: 28,
      morale: 58,
      distance: 520,
      terrain: "broken hillside",
      resistance: 0.92
    },
    {
      id: "center",
      label: "Center Road",
      enemyLabel: "Warband Center",
      x: 0.5,
      strength: 36,
      morale: 66,
      distance: 610,
      terrain: "packed road",
      resistance: 1.0
    },
    {
      id: "right",
      label: "Right Orchard",
      enemyLabel: "Javelin Mob",
      x: 0.77,
      strength: 24,
      morale: 54,
      distance: 470,
      terrain: "olive grove",
      resistance: 0.84
    }
  ],

  sequence: {
    nodes: [
      {
        id: "deploy",
        hint: "Select a lane, choose a formation, then press Space to charge."
      },
      {
        id: "first-charge",
        afterEvent: "cavalry.charge.started",
        hint: "Momentum builds while charging. Wedge hits hardest; Screen preserves cohesion."
      },
      {
        id: "first-impact",
        afterEvent: "cavalry.impact.resolved",
        hint: "Rally with R if cohesion drops before the next charge."
      },
      {
        id: "endgame",
        afterEvent: "cavalry.enemy.routed",
        hint: "Exploit the gap. Break every enemy lane to secure the road."
      }
    ]
  }
});
