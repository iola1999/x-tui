# Vendored `twitter-cli`

`x-tui` now maintains its Python `twitter-cli` dependency in-tree at `vendor/twitter-cli`.

This is the primary development workflow:

- Keep the Python project isolated under `vendor/twitter-cli`.
- Keep the Bun app talking to it only through the executable and daemon JSONL protocol boundary.
- Do not mix Python modules into `src/` or make TypeScript import vendored Python code directly.

## Local setup

```bash
cd vendor/twitter-cli
uv sync
./.venv/bin/twitter auth login
./.venv/bin/twitter status
```

When `vendor/twitter-cli/.venv/bin/twitter` exists, `x-tui` auto-detects it by default. Packaged installs still support `X_TUI_TWITTER_CMD` and `PATH` fallback.

## Verification

```bash
cd vendor/twitter-cli
uv sync --extra dev
uv run pytest -q
uv run ruff check .
```

From the repo root:

```bash
bun test
bun run typecheck
bun run build
```

## Future standalone package

We are not publishing a separate package right now. To preserve that option later:

- keep `vendor/twitter-cli` self-contained as a normal Python project
- avoid cross-repo assumptions in the Bun code beyond invoking the binary
- if needed, split it back out with `git subtree split` or by copying the isolated directory into a standalone repo
