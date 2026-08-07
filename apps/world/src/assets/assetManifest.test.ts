import { describe, expect, it } from 'vitest';
import { ASSET_MANIFEST, getAssetPack, listAssetPacksByCategory } from './assetManifest';

describe('ASSET_MANIFEST', () => {
  it('has unique pack ids', () => {
    const ids = ASSET_MANIFEST.map((pack) => pack.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every pack at least one file', () => {
    for (const pack of ASSET_MANIFEST) {
      expect(pack.files.length, `${pack.id} has no files`).toBeGreaterThan(0);
    }
  });

  it('never claims a license without a licenseStatus of confirmed or needs-review', () => {
    for (const pack of ASSET_MANIFEST) {
      if (pack.license) {
        expect(['confirmed', 'needs-review']).toContain(pack.licenseStatus);
      }
    }
  });

  it('flags every pack with no recorded source as missing, not confirmed', () => {
    for (const pack of ASSET_MANIFEST) {
      if (!pack.source && !pack.license) {
        expect(pack.licenseStatus).toBe('missing');
      }
    }
  });

  it('resolves packs by id', () => {
    expect(getAssetPack('flashlight')?.category).toBe('handheld');
    expect(getAssetPack('does-not-exist')).toBeUndefined();
  });

  it('filters packs by category', () => {
    const vegetation = listAssetPacksByCategory('vegetation');
    expect(vegetation.length).toBeGreaterThanOrEqual(7);
    expect(vegetation.every((pack) => pack.category === 'vegetation')).toBe(true);
  });
});
