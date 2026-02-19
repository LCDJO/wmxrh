/**
 * Versioning Engine Domain Events — autodiscovered by event catalog.
 */

export const __DOMAIN_CATALOG = {
  domain: 'Versioning Engine',
  color: 'hsl(270 50% 50%)',
  events: [
    { name: 'ModuleVersionReleased', description: 'Nova versão de módulo publicada' },
    { name: 'RollbackExecuted', description: 'Rollback de versão executado' },
    { name: 'DeprecationScheduled', description: 'Depreciação de módulo agendada' },
    { name: 'BreakingChangeDetected', description: 'Breaking change detectada em dependência' },
    { name: 'ChangelogGenerated', description: 'Changelog gerado automaticamente' },
    { name: 'DependencyResolved', description: 'Dependência entre módulos resolvida' },
    { name: 'VersionSnapshotCreated', description: 'Snapshot de versão criado' },
  ],
};
