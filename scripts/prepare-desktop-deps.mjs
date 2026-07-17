import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (process.platform !== 'darwin') {
  process.stdout.write('desktop:prepare: no macOS native dependencies required\n');
  process.exit(0);
}

const nodeGyp = path.join(projectRoot, 'node_modules', '.bin', 'node-gyp');
if (!fs.existsSync(nodeGyp)) {
  throw new Error('node-gyp is missing; run pnpm install before building the desktop app');
}

const nativeDependencies = [
  { name: 'macos-alias', output: ['build', 'Release', 'volume.node'] },
  { name: 'fs-xattr', output: ['build', 'Release', 'xattr.node'] }
];

for (const dependency of nativeDependencies) {
  const dependencyRoot = path.join(projectRoot, 'node_modules', dependency.name);
  const outputPath = path.join(dependencyRoot, ...dependency.output);

  if (fs.existsSync(outputPath)) {
    continue;
  }

  if (!fs.existsSync(dependencyRoot)) {
    throw new Error(`${dependency.name} is missing; run pnpm install before building the desktop app`);
  }

  process.stdout.write(`desktop:prepare: building ${dependency.name}\n`);
  const result = spawnSync(nodeGyp, ['rebuild', '--directory', dependencyRoot], {
    cwd: projectRoot,
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  if (!fs.existsSync(outputPath)) {
    throw new Error(`native build completed without creating ${outputPath}`);
  }
}

process.stdout.write('desktop:prepare: native dependencies ready\n');
