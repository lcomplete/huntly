# Repository Guidelines

## Project Structure & Module Organization
`app/server/` contains the Spring Boot parent with `huntly-server`, `huntly-jpa`, `huntly-common`, and `huntly-interfaces`. `app/client/` serves the React SPA, `app/extension/` holds the browser add-on, and `app/tauri/` ships the desktop shell. Shared static assets live in `static/`; container manifests sit in `Dockerfile*` and `docker-compose.yml`.

## Build, Test, and Development Commands
- Server: `cd app/server && ./mvnw clean verify` builds everything; `./mvnw spring-boot:run -pl huntly-server -am` serves `localhost:8080`.
- Web client: `cd app/client && yarn install && yarn start`; use `yarn build` for production assets and `yarn test` for the Jest suite.
- Browser extension: `cd app/extension && npm install && npm run dev`; guard releases with `npm run build` and `npm run test`.
- Desktop shell: `cd app/tauri && npm install && npm run tauri dev`; `npm run build` bundles the desktop app.
- Containers: `docker-compose up -d` runs the published image; `docker build -t huntly-local -f Dockerfile .` produces a workspace-aware image.

## Coding Style & Naming Conventions
Java code uses four-space indentation, `com.huntly.*` packages, and Lombok DTOs; keep controllers in `huntly-server` and persistence code in `huntly-jpa`. TypeScript components and hooks are PascalCase files with camelCase props and co-located Tailwind styles. The React app follows `react-scripts` ESLint defaults, and the extension formats with `npm run style`. Name static assets and env samples in kebab-case to match the existing tree.

## Testing Guidelines
Java modules rely on JUnit 5 and AssertJ; place tests beside new code under `src/test/java` and run `./mvnw test` (or module-targeted variants) before pushing. The React client uses React Testing Library through `yarn test`; name files `<Component>.test.tsx`. Extension suites run with ts-jest via `npm run test`; provide deterministic fixtures for new parsers or DOM mutations.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat:`, `fix:`, optional scopes) in imperative voice, keeping subjects ≤72 characters. PRs should link issues, describe impact, attach UI captures when relevant, and confirm `./mvnw clean verify`, `yarn test`, and `npm run test` succeed. Flag schema, Docker, or configuration changes explicitly for reviewers.

## Security & Configuration Tips
Avoid committing SQLite artifacts in `app/server/db.sqlite*`; persist data through the `/data` volume when containerised. Store secrets in environment variables or Tauri keychains. Expose the API over HTTPS using the JVM flags listed in `README.en.md`, and review CORS settings before distributing new browser builds.
