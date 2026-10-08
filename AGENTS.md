# Repository guidance

## Project overview

This repository contains an Obsidian Desktop plugin that invokes the installed Git executable. Git remains responsible for repository data and Git semantics. Supported desktop operating systems are Linux, Windows, and macOS; the plugin manifest is desktop-only.

The plugin presents a bottom status-bar indicator and command-palette actions for status, fetch, pull, commit-all, push, and sync. Commit, push, and sync stage all vault changes. Pull errors are surfaced to the user; the plugin does not resolve conflicts automatically.

## Architecture

- `src/main.ts` is the Obsidian entry point and coordinates plugin lifecycle, UI, settings, localization, and Git actions.
- `src/git/process-runner.ts` defines the process-runner port and its Node.js `execFile` implementation.
- `src/git/git-cli.ts` maps domain operations to argument arrays and returns command results.
- `src/git/git-executable-locator.ts` searches PATH and common platform-specific install paths, then validates candidates with `git --version`.
- `src/git/git-service.ts` checks exit results and exposes status, fetch, pull, push, and commit-all behavior.
- `src/git/status-parser.ts` parses Git porcelain v2 status output.
- `src/i18n/` holds typed English and Russian messages and resolves the language returned by Obsidian.
- Settings and status UI live in `src/settings*.ts` and `src/status-modal.ts`.
- Tests are grouped by domain. Integration tests create temporary local repositories and never need a network remote.

Keep executable discovery in `GitExecutableLocator` and process execution behind the `ProcessRunner` interface. Preserve the configured executable as a user override; default discovery checks PATH before common OS installation paths. Pass each Git argument as an individual item to `execFile`; do not interpolate commands into a shell string. Keep OS-specific behavior behind the process adapter and use Node path/process APIs rather than platform-specific path assumptions.

## Localization

Use `getLanguage()` from Obsidian as the source of the selected app language. Add user-facing text to the typed locale objects in `src/i18n/en.ts` and `src/i18n/ru.ts`; avoid UI strings in feature modules. Unsupported language codes fall back to English. Add unit coverage for locale selection or formatting changes.

## No magic strings or numbers

Do not add unexplained string or numeric literals to executable TypeScript, test data, or build configuration. Put values into a nearby, domain-named `const`/`as const` object or a TypeScript enum, then refer to those names at use sites.

This applies to Git argument vectors and porcelain markers, process exit codes and limits, setting defaults and validation bounds, command IDs, UI copy, CSS class names referenced from TypeScript, DOM tag/attribute names, locale keys, timestamps, status labels, build paths, and test fixtures/expected values. Use enums for finite states and discriminants; use `as const` objects for structured configuration and argument vectors.

Keep constants close to the domain that owns them. Do not create a generic catch-all constants file. Share a constant only when the same semantic value is genuinely shared.

Human-readable test descriptions and comments are prose, not magic values. Import specifiers, package/Obsidian manifests, workflow syntax, CSS selectors, and values whose syntax is fixed by an external tool format are declarative syntax; keep those in the required format. Runtime values derived from those formats must still be named constants or enums.

## Build and verification

- `npm run dev` watches TypeScript and writes the plugin package to `dist/`.
- `npm run build` typechecks and writes `main.js`, `manifest.json`, `styles.css`, and `versions.json` to `dist/`. It removes the obsolete root `main.js` artifact.
- `npm run test:unit` runs unit tests.
- `npm run test:integration` runs local Git integration tests.
- `npm run check` runs typechecking and all tests.

Before finishing a code change, review new literals and run typecheck, unit tests, integration tests, and the production build. CI repeats these checks on Linux, Windows, and macOS.
