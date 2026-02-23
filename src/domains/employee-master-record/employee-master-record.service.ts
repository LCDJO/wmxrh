/**
 * Employee Master Record — Aggregate Service
 *
 * Composes all satellite services into a unified employee record view.
 */
import { employeeRecordService } from './employee-record.service';
import { employeePersonalDataService } from './employee-personal-data.service';
import { employeeDocumentService } from './employee-document.service';
import { employeeAddressService } from './employee-address.service';
import { employeeDependentService } from './employee-dependent.service';
import { employeeContractService } from './employee-contract.service';
import type { EmployeeMasterRecord } from './types';

export const employeeMasterRecordService = {
  async loadFullRecord(employeeId: string, tenantId: string): Promise<EmployeeMasterRecord> {
    const [record, personalData, documents, addresses, dependents, contracts] = await Promise.all([
      employeeRecordService.getByEmployee(employeeId, tenantId),
      employeePersonalDataService.getByEmployee(employeeId, tenantId),
      employeeDocumentService.listByEmployee(employeeId, tenantId),
      employeeAddressService.listByEmployee(employeeId, tenantId),
      employeeDependentService.listByEmployee(employeeId, tenantId),
      employeeContractService.listByEmployee(employeeId, tenantId),
    ]);

    return {
      employee_id: employeeId,
      record,
      personalData,
      documents,
      addresses,
      dependents,
      contracts,
    };
  },
};
