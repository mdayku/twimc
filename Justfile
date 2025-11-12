test:      "pnpm test -w || pytest -q"
typecheck: "tsc --noEmit || true"
lint:      "pnpm lint -w || ruff ."
ghost:     "npx -y ts-unused-exports || vulture ."
schema:    "pnpm prisma generate && pnpm prisma migrate status"

ship:      "just typecheck && just test && just lint && just ghost"