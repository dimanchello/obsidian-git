import esbuild from 'esbuild';
import { builtinModules } from 'node:module';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const BUILD_CONFIG = Object.freeze({
  productionArgumentIndex: 2,
  productionMode: 'production',
  entryPoints: ['src/main.ts'],
  externalPackages: ['obsidian', 'electron'],
  nodeProtocolPrefix: 'node:',
  format: 'cjs',
  target: 'es2021',
  platform: 'node',
  developmentSourceMap: 'inline',
  outputDirectory: 'dist',
  outputFile: 'main.js',
  rootBuildArtifact: 'main.js',
  staticFiles: ['manifest.json', 'styles.css', 'versions.json'],
});

const production = process.argv[BUILD_CONFIG.productionArgumentIndex] === BUILD_CONFIG.productionMode;
const outputFile = join(BUILD_CONFIG.outputDirectory, BUILD_CONFIG.outputFile);
const external = [
  ...BUILD_CONFIG.externalPackages,
  ...builtinModules,
  ...builtinModules.map((name) => BUILD_CONFIG.nodeProtocolPrefix + name),
];

await rm(BUILD_CONFIG.outputDirectory, { recursive: true, force: true });
await rm(BUILD_CONFIG.rootBuildArtifact, { force: true });
await mkdir(BUILD_CONFIG.outputDirectory, { recursive: true });
await Promise.all(
  BUILD_CONFIG.staticFiles.map((file) =>
    copyFile(file, join(BUILD_CONFIG.outputDirectory, file)),
  ),
);

const context = await esbuild.context({
  entryPoints: BUILD_CONFIG.entryPoints,
  bundle: true,
  external,
  format: BUILD_CONFIG.format,
  target: BUILD_CONFIG.target,
  platform: BUILD_CONFIG.platform,
  sourcemap: production ? false : BUILD_CONFIG.developmentSourceMap,
  minify: production,
  treeShaking: true,
  outfile: outputFile,
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
