# Memory

- Intent: Add GitHub Pages deployment for the static cavalry-of-rome app.
- Finding: Git repo root is TheCavalryOfRome, so workflows must live in repo-level .github/workflows.
- Finding: The app is a no-build static site rooted at cavalry-of-rome/index.html, so Pages can serve the folder directly.
- Finding: cavalry-of-rome contains a nested .github folder, so Pages artifact must be staged cleanly to avoid publishing workflow files.
