# Repository Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Project Structure & Module Organization
`app/server/` contains the Spring Boot parent with `huntly-server`, `huntly-jpa`, `huntly-common`, and `huntly-interfaces`. `app/client/` serves the React SPA, `app/extension/` holds the Chrome/Firefox browser extension, and `app/tauri/` ships the desktop app built with Tauri + Vite. Shared static assets live in `static/`; container manifests sit in `Dockerfile*` and `docker-compose.yml`.

## Build, Test, and Development Commands
- Server: `cd app/server` and use `./start-dev.sh` (primary dev mode, supports `--task` to enable connectors and `--sql` to show SQL); `./mvnw clean verify` builds everything; direct maven run: `./mvnw spring-boot:run -pl huntly-server -am` serves `localhost:8080`.
- Web client: `cd app/client && yarn install && yarn start`; use `yarn build` for production assets and `yarn test` for the Jest suite.
- Browser extension: `cd app/extension && yarn install && yarn dev`; guard releases with `yarn build` and `yarn test`.
- Desktop app (Tauri): `cd app/tauri && yarn install && yarn tauri dev`; `yarn build` compiles frontend and `yarn tauri build` bundles the desktop app.
- Containers: `docker-compose up -d` runs the published image; `docker build -t huntly-local -f Dockerfile .` produces a workspace-aware image.

## Coding Style & Naming Conventions
Java code uses four-space indentation, `com.huntly.*` packages, and Lombok DTOs; keep controllers in `huntly-server` and persistence code in `huntly-jpa`. TypeScript components and hooks are PascalCase files with camelCase props and co-located Tailwind styles. The React app follows `react-scripts` ESLint defaults, and the extension formats with `yarn style`. Name static assets and env samples in kebab-case to match the existing tree.

## Testing Guidelines
Java modules rely on JUnit 5 and AssertJ; place tests beside new code under `src/test/java` and run `./mvnw test` (or module-targeted variants) before pushing. The React client uses React Testing Library through `yarn test`; name files `<Component>.test.tsx`. Extension suites run with ts-jest via `yarn test`; provide deterministic fixtures for new parsers or DOM mutations.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat:`, `fix:`, optional scopes) in imperative voice, keeping subjects ≤72 characters. PRs should link issues, describe impact, attach UI captures when relevant, and confirm `./mvnw clean verify`, `yarn test` (client), and `yarn test` (extension) succeed. Flag schema, Docker, or configuration changes explicitly for reviewers.

## Security & Configuration Tips
Avoid committing SQLite artifacts in `app/server/huntly-server/db.sqlite*`; persist data through the `/data` volume when containerised. Store secrets in environment variables or Tauri keychains. Expose the API over HTTPS and review CORS settings before distributing new browser builds.

## Documentation Guidelines
When updating the project's README, ensure all language versions are updated consistently:
- `README.md` (English)
- `README.zh.md` (Chinese)

## UI Language Guidelines
All user interface text must be written in English. This applies to button labels, menu items, tooltips, error messages, notifications, form labels, and any user-facing strings across all clients (browser extension, web client, desktop app).

## Reply Guidelines

使用与用户发送的消息相同的语言进行回复。