/**
 * Semantic versioning utilities.
 */
import type { SemanticVersion } from './types';

export function formatVersion(v: SemanticVersion): string {
  let s = `${v.major}.${v.minor}.${v.patch}`;
  if (v.prerelease) s += `-${v.prerelease}`;
  if (v.build) s += `+${v.build}`;
  return s;
}

export function parseVersion(str: string): SemanticVersion {
  const [core, ...rest] = str.replace(/^v/, '').split(/[-+]/);
  const [major, minor, patch] = core.split('.').map(Number);
  return {
    major: major ?? 0,
    minor: minor ?? 0,
    patch: patch ?? 0,
    prerelease: rest[0],
  };
}

/** -1 if a < b, 0 if equal, 1 if a > b */
export function compareVersions(a: SemanticVersion, b: SemanticVersion): -1 | 0 | 1 {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

export function satisfiesRange(version: SemanticVersion, min: SemanticVersion, max?: SemanticVersion): boolean {
  if (compareVersions(version, min) < 0) return false;
  if (max && compareVersions(version, max) > 0) return false;
  return true;
}

export function bumpVersion(v: SemanticVersion, type: 'major' | 'minor' | 'patch'): SemanticVersion {
  switch (type) {
    case 'major': return { major: v.major + 1, minor: 0, patch: 0 };
    case 'minor': return { ...v, minor: v.minor + 1, patch: 0 };
    case 'patch': return { ...v, patch: v.patch + 1 };
  }
}

export function versionId(): string {
  return `ver-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
