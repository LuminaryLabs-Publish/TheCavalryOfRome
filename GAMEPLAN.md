# Cavalry of Rome Gameplan

## Direction

Build this as a 3D-first web game with a renderer that can present high-fidelity terrain, lighting, and camera work without tying the simulation to one graphics API.

## Technical Principle

- Keep battle simulation deterministic.
- Keep rendering swappable.
- Use WebGPU as the primary visual path.
- Preserve a WebGL path for compatibility and iteration.

## First Goal

The game opens with a cinematic overlook of complex terrain.

### Definition Of Done

- The player loads into a 3D battlefield vista.
- Terrain has visible depth, elevation, and horizon scale.
- Camera framing feels deliberate and cinematic.
- Lighting, sky, and fog create atmosphere.
- The scene performs smoothly in-browser.

## Milestones

### 1. Terrain Overlook

- Replace the current 2D presentation with a 3D scene shell.
- Build the opening camera path and default framing.
- Create terrain masses, ridgelines, and distant silhouettes.
- Add atmosphere, sky, shadows, and fog.
- Keep the current game state running behind the scene.

### 2. Battlefield Readability

- Introduce 3D unit presence and lane landmarks.
- Make tactical targets readable from the overlook.
- Add diegetic and HUD-based guidance for command flow.

### 3. Tactical Interaction

- Map existing formation and lane commands into the 3D scene.
- Show selection, charge intent, and impact clearly.
- Preserve deterministic outcomes and replayable logic.

### 4. Visual Fidelity Pass

- Upgrade materials, particles, animation, and camera motion.
- Add terrain variety, weather, and battle dressing.
- Tune performance budgets for real browsers.

### 5. Content Growth

- Expand into multiple terrain types and scenarios.
- Add mission structure, rewards, and campaign flow.
- Keep the renderer isolated from the domain layer.
