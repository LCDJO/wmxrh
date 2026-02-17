import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function registerCompensationEventHandlers(sandbox: SandboxContext): () => void {
  const unsubs: Array<() => void> = [];
  unsubs.push(
    sandbox.on('module:core_hr:employee_terminated', (payload: any) => {
      sandbox.emit('termination_payroll_triggered', payload);
    }),
  );
  return () => { for (const u of unsubs) u(); };
}
