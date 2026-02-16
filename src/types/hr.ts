export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  positionId: string;
  positionTitle: string;
  hireDate: string;
  status: 'active' | 'inactive' | 'on_leave';
  baseSalary: number;
  currentSalary: number;
  avatarUrl?: string;
}

export interface Position {
  id: string;
  title: string;
  department: string;
  level: string;
  baseSalary: number;
  maxSalary: number;
  employeeCount: number;
}

export interface SalaryHistory {
  id: string;
  employeeId: string;
  previousSalary: number;
  newSalary: number;
  reason: string;
  effectiveDate: string;
  approvedBy: string;
}

export interface Department {
  id: string;
  name: string;
  employeeCount: number;
  budget: number;
}

export type EmployeeStatus = Employee['status'];
