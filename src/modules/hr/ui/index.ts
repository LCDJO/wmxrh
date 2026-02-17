/**
 * HR Module — UI barrel export
 *
 * Lazy-loadable UI components for the HR module.
 */

export const HrModuleUI = {
  /** Main HR page (lazy) */
  loadPage: () => import('./HrPlaceholder'),
};
