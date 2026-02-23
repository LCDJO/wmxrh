/**
 * Employee Master Record — Aggregate Service
 *
 * Composes all satellite services into a unified employee record view.
 */
import { employeeDocumentService } from './employee-document.service';
import { employeeAddressService } from './employee-address.service';
import { employeeDependentService } from './employee-dependent.service';
import { employeeContractService } from './employee-contract.service';
import type { EmployeeMasterRecord } from './types';

export const employeeMasterRecordService = {
  /**
   * Load the complete master record for an employee (all satellite data).
   */
  async loadFullRecord(employeeId: string, tenantId: string): Promise<EmployeeMasterRecord> {
    const [documents, addresses, dependents, contracts] = await Promise.all([
      employeeDocumentService.listByEmployee(employeeId, tenantId),
      employeeAddressService.listByEmployee(employeeId, tenantId),
      employeeDependentService.listByEmployee(employeeId, tenantId),
      employeeContractService.listByEmployee(employeeId, tenantId),
    ]);

    return {
      employee_id: employeeId,
      documents,
      addresses,
      dependents,
      contracts,
    };
  },
};
