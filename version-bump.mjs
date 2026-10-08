import { readFileSync, writeFileSync } from 'node:fs';

const VERSION_BUMP_CONFIG = Object.freeze({
  manifestFile: 'manifest.json',
  versionsFile: 'versions.json',
  fileEncoding: 'utf8',
  jsonIndent: 2,
  trailingNewline: '\n',
  failureExitCode: 1,
  missingVersionMessage: 'Error: npm_package_version environment variable is not defined.',
});

const targetVersion = process.env.npm_package_version;

if (!targetVersion) {
  console.error(VERSION_BUMP_CONFIG.missingVersionMessage);
  process.exit(VERSION_BUMP_CONFIG.failureExitCode);
}

const manifestRaw = readFileSync(
  VERSION_BUMP_CONFIG.manifestFile,
  VERSION_BUMP_CONFIG.fileEncoding,
);
const manifest = JSON.parse(manifestRaw);
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync(
  VERSION_BUMP_CONFIG.manifestFile,
  JSON.stringify(manifest, null, VERSION_BUMP_CONFIG.jsonIndent) +
    VERSION_BUMP_CONFIG.trailingNewline,
  VERSION_BUMP_CONFIG.fileEncoding,
);

const versionsRaw = readFileSync(
  VERSION_BUMP_CONFIG.versionsFile,
  VERSION_BUMP_CONFIG.fileEncoding,
);
const versions = JSON.parse(versionsRaw);
versions[targetVersion] = minAppVersion;
writeFileSync(
  VERSION_BUMP_CONFIG.versionsFile,
  JSON.stringify(versions, null, VERSION_BUMP_CONFIG.jsonIndent) +
    VERSION_BUMP_CONFIG.trailingNewline,
  VERSION_BUMP_CONFIG.fileEncoding,
);
