/**
 * REPVersionRegistry — Controle de versões do REP-C.
 * Portaria 671/2021 Art. 78-80 — Rastreabilidade de atualizações.
 */

import type { REPVersion } from './types';

const INITIAL_VERSION: REPVersion = {
  id: 'v1.0.0',
  version: '1.0.0',
  release_date: '2026-01-15',
  changelog: 'Versão inicial do REP-C com conformidade Portaria 671/2021',
  is_current: true,
  compliance_level: 'full',
  portaria_version: '671/2021',
  features: [
    'AFD generation', 'AEJ generation', 'NTP sync',
    'Technical log with chain verification', 'Inspection export',
    'System identification', 'Immutable ledger integration',
  ],
  breaking_changes: [],
  deployed_at: '2026-01-15T00:00:00Z',
  deployed_by: 'system',
  content_hash: 'a1b2c3d4',
};

export class REPVersionRegistry {
  private versions: REPVersion[] = [{ ...INITIAL_VERSION }];

  getCurrent(): REPVersion {
    return this.versions.find(v => v.is_current) ?? this.versions[0];
  }

  getHistory(): REPVersion[] {
    return [...this.versions].sort((a, b) =>
      new Date(b.release_date).getTime() - new Date(a.release_date).getTime(),
    );
  }

  register(version: Omit<REPVersion, 'id' | 'is_current'>): REPVersion {
    // Mark all existing as not current
    for (const v of this.versions) v.is_current = false;

    const newVersion: REPVersion = {
      ...version,
      id: `v${version.version}`,
      is_current: true,
    };

    this.versions.push(newVersion);
    return newVersion;
  }
}
