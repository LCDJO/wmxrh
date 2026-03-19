/**
 * @deprecated Moved to src/components/navigation/navigation-panel-context.tsx
 * This re-export exists for backward compatibility.
 */
export type { PanelScope, PanelNavigationState } from '@/components/navigation/navigation-panel-context';
export {
  NavigationPanelProvider,
  useNavigationPanel,
  useCurrentPanelNavigation,
  usePanelGuard,
} from '@/components/navigation/navigation-panel-context';
