# Published Cavalry of Rome — Integration Notes

Target repository: `LuminaryLabs-Publish/TheCavalryOfRome`; branch `main`.
This change keeps the original strategic map, world rendering, recruitment, marching, economy, archived baseline, and existing assets. It adds an automatically opened 3D tactical encounter iframe at `cavalry-of-rome/tactical/`, a deterministic illustrated command-card deck, six 3D miniature assets, sculpted terrain-aware hex cells, and casualty/territory synchronization.

Contract: game host opens the same-origin iframe with a JSON `window.name` packet `cavalry:tactical:init:v1`. The tactical game renders using the true encounter's unit IDs, coordinate center, available terrain features and heightfield. On completion it posts a same-origin `cavalry:tactical:result:v1` message with one result per source deployment ID (including reserve cells mapped to the original garrison group). The host validates every message against source, origin, token, session and canonical roster before applying it once.

The root `npm test` includes both existing tests and the tactical tests. GitHub Actions workflows remain unchanged. Browser runtime validation must be performed on a computer where WebGL2 and navigation are allowed; prior sandbox Chromium was blocked from localhost with `ERR_BLOCKED_BY_ADMINISTRATOR`.

Nexus Authoring: the authoring pipeline exports GLB assets and retains source geometry scripts. The native installed Nexus `n:authoring` runtime was not executed here; do not claim verified native engine authoring evidence.
