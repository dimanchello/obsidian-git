# Git Commands

[![CI](https://github.com/dimanchello/obsidian-git/actions/workflows/ci.yml/badge.svg)](https://github.com/dimanchello/obsidian-git/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/dimanchello/obsidian-git)](https://github.com/dimanchello/obsidian-git/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A clean, lightweight native Git integration plugin for [Obsidian](https://obsidian.md) Desktop.

The plugin delegates repository, index, merge, and transport operations directly to your system's installed Git executable. By avoiding bundled JavaScript/Wasm Git reimplementations, it ensures maximum performance, security, and native Git semantics.

Supported desktop platforms: Linux, Windows, and macOS.

---

## Features

- **Status Bar Indicator**: Real-time indicator in the Obsidian status bar displaying:
  - Active branch name
  - Working-tree change counts (modified, staged, untracked)
  - Commits ahead of or behind the remote tracking branch
  - Interactive click menu with quick actions
- **Command Palette Actions**:
  - `Show status`: Open an interactive modal displaying changed files and branch sync state
  - `Fetch`: Fetch remote commits without altering working tree
  - `Pull`: Pull remote changes from upstream
  - `Commit all changes`: Stage all vault changes and create a commit
  - `Push`: Push local commits to the upstream branch
  - `Sync`: Pull latest remote commits then push local changes
- **Automation**:
  - Periodic background fetch (configurable interval; default 30s)
  - Configurable auto-sync interval
- **Customizable Commit Message**:
  - Commit message template support with `{datetime}` timestamp substitution (e.g., `vault backup: {datetime}`)
- **Executable Discovery**:
  - Automatic lookup in system `PATH` and common platform-specific directories (`/usr/bin/git`, `/usr/local/bin/git`, Program Files, Homebrew, Xcode command-line tools)
  - Optional custom executable command or absolute path in settings
- **Internationalization (i18n)**:
  - Automatic language selection matching Obsidian (English and Russian supported, graceful fallback to English)
- **Safe Execution**:
  - Non-shell child process execution (`execFile`) with strict argument arrays to prevent shell injection
  - Terminal interactive prompts disabled (`GIT_TERMINAL_PROMPT=0`)
  - Configurable process timeouts

---

## Prerequisites

1. **Obsidian Desktop** v1.8.7 or newer.
2. **Git** installed on your operating system and accessible in `PATH` (or configured via plugin settings).
3. Your vault must be inside an initialized Git repository (`git init`).

---

## Installation

### Via BRAT (Beta Reviewer's Auto-update Tester)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin from Obsidian Community Plugins.
2. Open BRAT settings and click **Add Beta plugin**.
3. Enter `dimanchello/obsidian-git`.
4. BRAT will automatically download the plugin and keep it updated.

### Manual Installation

1. Go to the [Releases](https://github.com/dimanchello/obsidian-git/releases) page and download the latest release files:
   - `main.js`
   - `manifest.json`
   - `styles.css`
2. Open your Obsidian vault folder and navigate to `.obsidian/plugins/`.
3. Create a new directory named `git-commands`.
4. Place `main.js`, `manifest.json`, and `styles.css` into that directory:
   ```
   <vault>/.obsidian/plugins/git-commands/
   ├── main.js
   ├── manifest.json
   └── styles.css
   ```
5. In Obsidian, go to **Settings > Community plugins**, click **Reload plugins**, and enable **Git Commands**.

---

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| **Git executable path** | *(empty)* | Optional path to the `git` binary. When blank, the plugin searches `PATH` and standard system locations. |
| **Commit message template** | `vault backup: {datetime}` | Commit message format. `{datetime}` is replaced with the local date and time. |
| **Auto-fetch interval (seconds)** | `30` | Interval between background fetches. Set to `0` to disable. |
| **Auto-sync interval (minutes)** | `0` | Interval between background syncs (pull + push). Set to `0` to disable. |

---

## Development

### Prerequisites

- Node.js 22+
- npm 10+

### Setup

```bash
# Clone the repository
git clone https://github.com/dimanchello/obsidian-git.git
cd obsidian-git

# Install dependencies
npm ci
```

### Scripts

- `npm run dev` &mdash; Watches source files and compiles in development mode into `dist/`.
- `npm run build` &mdash; Typechecks and bundles the plugin into `dist/` for production.
- `npm run check` &mdash; Runs TypeScript typechecking and all unit and integration tests.
- `npm run test:unit` &mdash; Runs isolated unit tests.
- `npm run test:integration` &mdash; Runs integration tests against local Git repositories.
- `npm version <patch|minor|major>` &mdash; Updates version in `package.json`, `manifest.json`, and `versions.json`.

---

## Architecture

- [`src/main.ts`](file:///home/angus123/project/js/obsidian-git/src/main.ts) &mdash; Obsidian entry point, commands, status bar integration, and lifecycle management.
- [`src/git/process-runner.ts`](file:///home/angus123/project/js/obsidian-git/src/git/process-runner.ts) &mdash; Node.js `execFile` abstraction avoiding shell interpolation.
- [`src/git/git-cli.ts`](file:///home/angus123/project/js/obsidian-git/src/git/git-cli.ts) &mdash; Maps high-level operations to Git argument vectors.
- [`src/git/git-executable-locator.ts`](file:///home/angus123/project/js/obsidian-git/src/git/git-executable-locator.ts) &mdash; Searches `PATH` and platform directories, validates with `git --version`.
- [`src/git/git-service.ts`](file:///home/angus123/project/js/obsidian-git/src/git/git-service.ts) &mdash; Validates command exit codes and coordinates status, fetch, pull, commit, and push.
- [`src/git/status-parser.ts`](file:///home/angus123/project/js/obsidian-git/src/git/status-parser.ts) &mdash; Parses Git porcelain v2 format.
- [`src/i18n/`](file:///home/angus123/project/js/obsidian-git/src/i18n/) &mdash; Typed English and Russian translations.

---

## License

This project is open source and available under the [MIT License](LICENSE).
