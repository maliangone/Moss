Your task: Run Docker integration tests on $ARGUMENTS

If $ARGUMENTS is "build" → build the Docker image and verify it succeeds.
If $ARGUMENTS is "full" → run the full docker-test skill (build + startup + UI + API + security).
If $ARGUMENTS is a component name → build, start, and test that specific component via Playwright.
If $ARGUMENTS is "security" → run security verification only (non-root, firewall, secrets, permissions).

Follow the docker-test skill instructions: build, start, verify, record results, fix bugs, retest.
