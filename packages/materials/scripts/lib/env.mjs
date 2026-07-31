// Shared by the bake scripts: resolves the local, machine-specific folder
// holding raw reference-art crops. Not part of the shipped src/ barrel.
import path from 'node:path';

try {
  process.loadEnvFile(path.resolve('.env'));
} catch {
  // No .env yet — fall through so the REF_DIR check below gives a clear error
  // instead of an ENOENT from loadEnvFile.
}

export const REF_DIR = process.env.REF_DIR;
if (!REF_DIR) {
  throw new Error(
    'REF_DIR is not set. Copy packages/materials/.env.example to .env and ' +
      'point it at your local folder of raw reference-art crops.',
  );
}
