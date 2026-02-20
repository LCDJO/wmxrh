/**
 * eSocial Governance Module — UI barrel export
 *
 * Lazy-loadable UI components for the module.
 */

export const EsocialGovModuleUI = {
  /** SuperAdmin dashboard (lazy) */
  loadSuperAdminDashboard: () => import('@/pages/EsocialGovernanceDashboard'),
};
