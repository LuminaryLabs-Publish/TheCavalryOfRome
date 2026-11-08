# Nexus Authoring review — Combat Miniatures and Terrain

## Intent and source boundary

Goal: create legible tabletop-scale 3D unit silhouettes, consistent with the active Cavalry of Rome terrain and card-command system. All assets must be reusable by light/medium/heavy combat classes, support health/quantity markers, and fit within each axial cell.

Nexus authoring conventions used as the authoring/review structure:

1. `n:authoring:design` — define silhouettes, world scale, and the terrain/miniature acceptance contract.
2. `n:authoring:art` — author and review mesh silhouettes, gear, faction palette, helmet crests, cavalry horses, shields and standards.
3. `n:authoring:craft` — validate GLB geometry, material color, transform origin, triangle budgets, bounds, repeated instances and low-zoom readability.

Native Engine `nexusengine/domains/authoring` execution is **not available** in this sandbox. The command verbs above name the real domain roles but are *not* fabricated receipts. Executable `authoring/build_miniatures.py` contains the actual source for these meshes. Its exported GLBs can be loaded by the NexusEditor GLB adapter when the native Editor is accessible.

## Delivered assets

- `roman-light.glb`: helmeted light infantry, round shield, tunic, javelin, bronze accents.
- `roman-medium.glb`: armored infantry, rectangular scutum, raised gold boss, sword, red plume.
- `roman-heavy.glb`: cavalry horse with neck, four legs, head, bridle, tack, mounted armored rider and lance.
- `enemy-light.glb`, `enemy-medium.glb`, `enemy-heavy.glb`: analogous opposing pieces, different tunics, helmets and shield palettes.

## Quality gates

- All 6 GLBs are valid glTF 2.0, contain visible triangle geometry and multiple vertex colors.
- They have stable origin and face +Z; opposing formations face the other army via a 180° model transform.
- The game places 2 mounted / 3 infantry models per occupied tile, not one sprite per unit.
- Every living unit projects a label with type, HP and estimated soldier count into screen space each frame.
- Trees and hexes remain world-space geometry; no billboard terrain or flattened map texture.
- The authored scene is about 121k triangles before miniatures; a future LOD pass is advisable for mobile GPU budgets.

## Remaining proof

- Native Nexus Authoring `project.execute()` receipts: **not run**.
- Browser/WebGL visual regression and screenshot capture: **blocked** by sandbox browser policy.
- Original Three.js integration and strategic campaign persistence: **not implemented**.
