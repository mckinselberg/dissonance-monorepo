import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ASSET_MANIFEST, type AssetPack } from '../src/assets/assetManifest';

/**
 * Pure Node-side audit logic for ASSET_MANIFEST vs. the actual contents of
 * apps/world/public/models/. Split from assetManifest.ts (which stays
 * fs-free so it can load in the browser) and imported by both the vitest
 * drift-check test and the standalone report script, so the two never
 * define "drift" differently.
 */

export interface DriftReport {
  /** Folders on disk with no ASSET_MANIFEST entry at all. */
  unlistedPackDirs: string[];
  /** Manifest entries whose pack folder doesn't exist on disk. */
  missingPackDirs: string[];
  /** Manifest file entries that don't exist on disk, keyed by pack id. */
  missingFiles: { packId: string; path: string }[];
  /** .glb/.gltf files on disk not covered by any manifest file entry, keyed by pack id. */
  uncataloguedFiles: { packId: string; path: string }[];
}

export interface AuditFindings {
  licenseGaps: { packId: string; status: AssetPack['licenseStatus']; notes?: string }[];
  unprocessedHeavyPacks: { packId: string; bytes: number }[];
}

function packDir(modelsRoot: string, pack: AssetPack): string {
  return path.join(modelsRoot, pack.id);
}

function listMeshFilesRecursive(dir: string, relativeTo = dir): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listMeshFilesRecursive(full, relativeTo));
    } else if (/\.(glb|gltf)$/i.test(entry.name)) {
      results.push(path.relative(relativeTo, full).split(path.sep).join('/'));
    }
  }
  return results;
}

export function findDrift(modelsRoot: string, manifest: AssetPack[] = ASSET_MANIFEST): DriftReport {
  const knownIds = new Set(manifest.map((pack) => pack.id));
  const packDirsOnDisk = readdirSync(modelsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const unlistedPackDirs = packDirsOnDisk.filter((id) => !knownIds.has(id)).sort();
  const missingPackDirs: string[] = [];
  const missingFiles: { packId: string; path: string }[] = [];
  const uncataloguedFiles: { packId: string; path: string }[] = [];

  for (const pack of manifest) {
    const dir = packDir(modelsRoot, pack);
    if (!existsSync(dir)) {
      missingPackDirs.push(pack.id);
      continue;
    }

    for (const file of pack.files) {
      if (!existsSync(path.join(dir, file.path))) {
        missingFiles.push({ packId: pack.id, path: file.path });
      }
    }

    const listed = new Set(pack.files.map((file) => file.path.split(path.sep).join('/')));
    for (const found of listMeshFilesRecursive(dir)) {
      if (!listed.has(found)) {
        uncataloguedFiles.push({ packId: pack.id, path: found });
      }
    }
  }

  return { unlistedPackDirs, missingPackDirs, missingFiles, uncataloguedFiles };
}

export function isDriftClean(report: DriftReport): boolean {
  return (
    report.unlistedPackDirs.length === 0
    && report.missingPackDirs.length === 0
    && report.missingFiles.length === 0
    && report.uncataloguedFiles.length === 0
  );
}

/** Total bytes of a pack's listed files that actually exist on disk. */
function packSizeBytes(modelsRoot: string, pack: AssetPack): number {
  const dir = packDir(modelsRoot, pack);
  return pack.files.reduce((sum, file) => {
    const full = path.join(dir, file.path);
    return existsSync(full) ? sum + statSync(full).size : sum;
  }, 0);
}

const UNPROCESSED_HEAVY_THRESHOLD_BYTES = 1_000_000;

export function buildFindings(modelsRoot: string, manifest: AssetPack[] = ASSET_MANIFEST): AuditFindings {
  const licenseGaps = manifest
    .filter((pack) => pack.licenseStatus !== 'confirmed')
    .map((pack) => ({ packId: pack.id, status: pack.licenseStatus, notes: pack.notes }));

  const unprocessedHeavyPacks = manifest
    .filter((pack) => !pack.processing?.length && existsSync(packDir(modelsRoot, pack)))
    .map((pack) => ({ packId: pack.id, bytes: packSizeBytes(modelsRoot, pack) }))
    .filter((entry) => entry.bytes > UNPROCESSED_HEAVY_THRESHOLD_BYTES)
    .sort((a, b) => b.bytes - a.bytes);

  return { licenseGaps, unprocessedHeavyPacks };
}

export function formatDriftReport(report: DriftReport): string {
  const lines: string[] = [];
  if (report.unlistedPackDirs.length) {
    lines.push(`Folders on disk with no manifest entry: ${report.unlistedPackDirs.join(', ')}`);
  }
  if (report.missingPackDirs.length) {
    lines.push(`Manifest entries with no folder on disk: ${report.missingPackDirs.join(', ')}`);
  }
  for (const { packId, path: filePath } of report.missingFiles) {
    lines.push(`${packId}: manifest lists "${filePath}", not found on disk`);
  }
  for (const { packId, path: filePath } of report.uncataloguedFiles) {
    lines.push(`${packId}: "${filePath}" exists on disk but has no manifest entry`);
  }
  return lines.length ? lines.join('\n') : 'No drift.';
}

export function formatFindingsReport(findings: AuditFindings): string {
  const lines: string[] = [];
  lines.push(`License gaps (${findings.licenseGaps.length}):`);
  for (const gap of findings.licenseGaps) {
    lines.push(`  [${gap.status}] ${gap.packId}${gap.notes ? ` — ${gap.notes}` : ''}`);
  }
  lines.push(`\nNo recorded processing pass, >${(UNPROCESSED_HEAVY_THRESHOLD_BYTES / 1_000_000).toFixed(0)}MB on disk (${findings.unprocessedHeavyPacks.length}):`);
  for (const entry of findings.unprocessedHeavyPacks) {
    lines.push(`  ${entry.packId} — ${(entry.bytes / 1_000_000).toFixed(1)}MB`);
  }
  return lines.join('\n');
}
