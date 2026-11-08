import { spawnSync } from 'node:child_process';

// Runs a Python script in headless Blender on the scene set in .env: `tsx scripts/blender.ts scripts/bake.py`
try {
  process.loadEnvFile();
} catch {
  throw new Error('Missing .env: copy .env.sample to .env and set BLENDER and BLEND_FILE');
}
const { BLENDER, BLEND_FILE } = process.env;
if (!BLENDER || !BLEND_FILE)
  throw new Error('Set BLENDER and BLEND_FILE in .env (see .env.sample)');

const { status, error } = spawnSync(
  BLENDER,
  ['-b', BLEND_FILE, '--python-exit-code', '1', '-P', process.argv[2]],
  {
    stdio: 'inherit',
  },
);
if (error) throw error;
process.exit(status ?? 1);
