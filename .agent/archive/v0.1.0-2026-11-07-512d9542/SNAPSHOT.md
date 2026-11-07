# Cavalry of Rome — immutable source snapshot

Archive: .agent/archive/v0.1.0-2026-11-07-512d9542
Source repository: https://github.com/LuminaryLabs-Publish/TheCavalryOfRome
Source branch: main
Source commit: 512d95429b59e7140060030009d9dd778246dded
Source Git tree: b0392888fb82af89d2e295317f76d32d55b337ac
Source game package version: 0.1.0
Captured date: 2026-11-07
Tracked source file count: 37

## Scope
Complete tracked repository content at source commit, including root documentation, licenses, CI/deployment workflows, game HTML, JavaScript modules, tests, and existing screenshot evidence. Files are copied byte-for-byte using their existing Git blob SHA. The enclosing .agent archive README is new snapshot metadata, not part of the original tree.

## Restore / run
The original deployable game is under `cavalry-of-rome/` relative to this snapshot root. To run independently, copy the snapshot contents to a clean directory, then run `cd cavalry-of-rome && npm test` and serve its `index.html` over HTTP. The original Pages workflow expects `cavalry-of-rome/` at repository root and should NOT be redirected to this archive. Git commit 512d95429b59e7140060030009d9dd778246dded remains the exact original rollback source.

## Limits
This is a repository-tracked source snapshot. Git-ignored, uncommitted, external CDN, or local-only artifacts are not included. No claim of current deployed-site or hardware validation is made by creating this archive. Preserve this folder unchanged; use new versioned snapshot folders for future baselines.

## Original blob inventory

- `.gitattributes` — `dfe0770424b2a19faf507a501ebfc23be8f54e7b` (66 bytes)
- `.github/workflows/deploy-pages.yml` — `d00be0804403f830c511a946b31c080514b545be` (1150 bytes)
- `.gitignore` — `1170717c1478bdeb91fe179e892ee76371ff88de` (2141 bytes)
- `GAMEPLAN.md` — `a711ea16af6b6a8708330fd66d4d2fd028771205` (1820 bytes)
- `LICENSE` — `af8f259405fba04f21c0ee70a4c09605bde7902c` (1070 bytes)
- `README.md` — `e355c6fb8aa6e2651f4c8efc1db9735f5eb71ba2` (66 bytes)
- `cavalry-of-rome/.github/workflows/ci.yml` — `5047b2fc55ae81d96d68360de25adaababbf68dc` (292 bytes)
- `cavalry-of-rome/.gitignore` — `7d37aeb008a2bfff9f74b9c140de97b0222be6eb` (39 bytes)
- `cavalry-of-rome/EXPERIMENT.md` — `ceceb155be58f9e527822a709515534de84781c6` (1073 bytes)
- `cavalry-of-rome/README.md` — `8e6c2ccedb23f4b45a53b83681e231db7cdfe151` (2037 bytes)
- `cavalry-of-rome/docs/architecture.md` — `45178c33a51bcab9482078ac5f0195018065e873` (1540 bytes)
- `cavalry-of-rome/docs/domain-contracts.md` — `145e74be06278c03316a297276ffa1f4ad2320c0` (1793 bytes)
- `cavalry-of-rome/docs/game-design.md` — `2440964a1e2e64c45d47d50a8b30b70bb1d51b2b` (1174 bytes)
- `cavalry-of-rome/index.html` — `451475112d776cbd27bfc69a164e70baadbda3cc` (4066 bytes)
- `cavalry-of-rome/package.json` — `5af08d24ba5a6832bf525f45c0f9a4902a9577f6` (476 bytes)
- `cavalry-of-rome/playwright-paths-desktop.png` — `10f84db5470810335ac94f9200c55eabfc8a4d3b` (1775081 bytes)
- `cavalry-of-rome/playwright-paths-mobile.png` — `e8bf421cc17decfe88ca991de7618e4f75867f67` (334059 bytes)
- `cavalry-of-rome/playwright-province-select.png` — `035fb0664cbc47aeb91f8cb7d46f57e51dd945dd` (3293665 bytes)
- `cavalry-of-rome/src/army-renderer.js` — `298753dca07ddf96d8fc4136bc212a610af4171d` (16852 bytes)
- `cavalry-of-rome/src/cavalry-of-rome-kit.js` — `cc12ab28060b9fdf5bfab5978d550cb321f6d49c` (42057 bytes)
- `cavalry-of-rome/src/control-button-kit.js` — `f4fb432746ecd382bb506958be563b713e6dc91f` (1168 bytes)
- `cavalry-of-rome/src/control-panel-kit.js` — `b5fbc8f86f14b3efa47b346bfe3e019d2fbb61f1` (5338 bytes)
- `cavalry-of-rome/src/encounter-terrain.js` — `968374ccdf0cc99a89565a69cc74493a2012dca2` (8876 bytes)
- `cavalry-of-rome/src/input-adapter.js` — `a5baeb3ab0a26d4a346c82c0529b40f28faf3088` (3667 bytes)
- `cavalry-of-rome/src/level-01.js` — `6cc63088e9ba6b3171917460231306433b0e2ece` (2401 bytes)
- `cavalry-of-rome/src/main.js` — `72faba0321988490b9027bce597b458775747cdc` (2302 bytes)
- `cavalry-of-rome/src/prop-safe-renderer.js` — `b0b6d653abef7ac15442c54ebc8684bb013cf672` (6372 bytes)
- `cavalry-of-rome/src/province-command-panel-kit.js` — `11d20f0bd22a8f9ec236c988f091b5ae02f9e3dc` (10844 bytes)
- `cavalry-of-rome/src/renderer.js` — `0b1242ee8bd2b3605c3457dea9e760b488763651` (123931 bytes)
- `cavalry-of-rome/src/runtime.js` — `b7afceda9b0488c148b7a0eb6f1b09c2306a114a` (3955 bytes)
- `cavalry-of-rome/src/sequences.js` — `772af14b33b17610ceee332c9ca579c361ce4bdf` (1277 bytes)
- `cavalry-of-rome/src/strategic-board-game-loop-kit.js` — `67bf6df4e3667e065909ae97670d2d568e006fb6` (17193 bytes)
- `cavalry-of-rome/src/strategic-command-ui.js` — `3e1de98448dd6555b4087234701a3dab7c6373ae` (13307 bytes)
- `cavalry-of-rome/src/visual-upgrade-renderer.js` — `91c979f2601e7cfede4ab6923a478c6ee52d4d5e` (18268 bytes)
- `cavalry-of-rome/src/water-safe-renderer.js` — `6c89f1ca26ca14a3aab6f76bc3c3c13bf0650f78` (28011 bytes)
- `cavalry-of-rome/tests/cavalry-of-rome-kit.test.mjs` — `bae771063d9ca2b4b80e3fa19c357f36bb405023` (12624 bytes)
- `memory.md` — `8744e889843b414eccbab92ce02946f34a03fe97` (15658 bytes)
