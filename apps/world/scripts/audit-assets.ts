import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_MANIFEST } from '../src/assets/assetManifest';
import {
  buildFindings,
  findDrift,
  formatDriftReport,
  formatFindingsReport,
  isDriftClean,
} from './assetManifestAudit';

const MODELS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/models');

const drift = findDrift(MODELS_ROOT, ASSET_MANIFEST);
const findings = buildFindings(MODELS_ROOT, ASSET_MANIFEST);

console.log(`Audited ${ASSET_MANIFEST.length} packs against ${MODELS_ROOT}\n`);

console.log('--- Drift (manifest vs. disk) ---');
console.log(formatDriftReport(drift));

console.log('\n--- Findings (informational) ---');
console.log(formatFindingsReport(findings));

if (!isDriftClean(drift)) {
  console.error('\nDrift found — see above. Update apps/world/src/assets/assetManifest.ts.');
  process.exitCode = 1;
} else {
  console.log('\nNo drift.');
}
