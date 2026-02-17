export {
  fetchAutomationRules,
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
  toggleAutomationRule,
  fetchRuleExecutions,
  evaluateConditions,
  executeActions,
  logExecution,
} from './automation-engine.service';

export type * from './automation.types';
export { TRIGGER_EVENT_CATALOG, ACTION_TYPE_CATALOG } from './automation.types';
