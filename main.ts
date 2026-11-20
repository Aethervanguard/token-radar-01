// token-radar-01 entrypoint (Node 22, standard library only).
//
// Reads the sealed snapshot, scores every pre-token protocol with the radar-4
// model in lib/model.ts, and writes the ranked board, the dashboard data, the
// dashboard and screenshots, and the dossier the judge reads.
//
// Layout of the run:
//   snapshot  -> parseSnapshot -> buildRadar -> board.json + data.js
//   dashboard/ + screenshots/   -> copied into the output directory
//   dossier.json                -> built last from the finished output
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

/** Caps the scorer enforces on its own output (reference/gate.json). */
const TEXT_BYTES_MAX = 65_536;
const SHOTS = { max: 4, max_bytes: 524_288 };
const SHOT_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** Read `--flag value` or `--flag=value` from the arguments, else `fallback`. */
function flag(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1]!;
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq === undefined ? fallback : eq.slice(name.length + 3);
}

/** Copy a directory's regular files into `dest`, skipping dotfiles; returns the names copied. */
function copyDir(src: string, dest: string): string[] {
  if (!existsSync(src)) return [];
  mkdirSync(dest, { recursive: true });
  const names: string[] = [];
  for (const name of readdirSync(src)) {
    if (name.startsWith('.')) continue;
    const from = join(src, name);
    if (!statSync(from).isFile()) continue;
    copyFileSync(from, join(dest, name));
    names.push(name);
  }
  return names;
}

function fail(message: string, code = 1): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(code);
}

function main(): void {
  const inputArg = flag('input', '/input');
  const snapshotPath = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
  if (!existsSync(snapshotPath)) {
    fail(`no snapshot at ${snapshotPath}: pass --input <snapshot.json|directory> or mount the sealed /input`, 2);
  }
  const outDir = flag('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

  const snapshot = parseSnapshot(readFileSync(snapshotPath, 'utf8'));
  const { board, radar } = buildRadar(snapshot);
  const problem = boardIssue(board, snapshot);
  if (problem !== null) fail(`the model wrote a board the gate refuses: ${problem}`);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
  writeFileSync(join(outDir, 'data.js'), dataScript(radar));

  copyDir(join(rootDir, 'dashboard'), join(outDir, 'dashboard'));
  const shots = copyDir(join(rootDir, 'screenshots'), join(outDir, 'screenshots'));
  if (shots.length < 3) {
    fail(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`);
  }
  for (const name of shots) {
    if (!SHOT_NAME.test(name)) {
      fail(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
    }
  }

  // The dossier goes last: the scorer rebuilds it from this /output and compares bytes.
  writeFileSync(
    join(outDir, 'dossier.json'),
    buildDossier(outDir, { text_max_bytes: TEXT_BYTES_MAX, screenshots: SHOTS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }),
  );

  process.stdout.write(
    `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
      `token radar: wrote ${join(outDir, 'board.json')}, ${join(outDir, 'data.js')}, ${join(outDir, 'dashboard')} (3 files), ${join(outDir, 'screenshots')} (${shots.length} images) and ${join(outDir, 'dossier.json')}\n`,
  );
}

main();
