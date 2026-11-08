# Multiplayer server deployment (operational checklist)

The GitHub Pages / itch.io HTML5 ZIP is a browser client. It cannot run the persistent Node match API by itself.

1. Deploy `cavalry-of-rome` to a Node.js 22+ server with a persistent mounted data volume.
2. Start `node multiplayer/server/index.mjs` with `CAVALRY_DATA_FILE=/data/cavalry/matches.json`, `HOST=0.0.0.0`, `PORT=8787`. Use a single server process; writes use atomic replacement and one in-process transaction queue.
3. Terminate HTTPS on the host or reverse proxy and forward API traffic to this process. Set `CORS_ORIGINS` to the exact tested itch iframe and GitHub Pages origins, separated by commas; do not use `*` for production.
4. In the browser War Council settings, enter the published HTTPS API base URL. Never put a recovery token in a link.
5. Confirm two independent browser identities can create/join by invitation, alternate turns, close/reconnect, and recover after backend restart. Run `npm test`.
6. Back up the mounted data file regularly, monitor disk space and process restarts, add request logs and abuse protection. Use a database and transactional compare-and-swap before scaling beyond a single writer process.
7. PeerJS is optional live notification only; it is **not** the durable match transport. Test the external PeerJS signaling service and direct connections from the embedded itch iframe. Polling works if PeerJS fails.
8. Do not publish the server until operator controls for account recovery, data retention, backups, and abuse handling are in place.

For reproducible local development: `cd cavalry-of-rome && npm run multiplayer:server`; open `http://localhost:8787/multiplayer/index.html` for same-origin play. For a static client in itch, set the external backend URL in War Council settings.
