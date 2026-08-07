import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findDrift, formatDriftReport } from './assetManifestAudit';

const MODELS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/models');

describe('ASSET_MANIFEST vs. apps/world/public/models on disk', () => {
  const report = findDrift(MODELS_ROOT);

  it('has no pack folder on disk missing from the manifest', () => {
    expect(report.unlistedPackDirs, formatDriftReport(report)).toEqual([]);
  });

  it('has no manifest entry pointing at a folder that does not exist', () => {
    expect(report.missingPackDirs, formatDriftReport(report)).toEqual([]);
  });

  it('has no manifest file entry missing from disk', () => {
    expect(report.missingFiles, formatDriftReport(report)).toEqual([]);
  });

  it('has no .glb/.gltf on disk uncatalogued by the manifest', () => {
    expect(report.uncataloguedFiles, formatDriftReport(report)).toEqual([]);
  });
});
