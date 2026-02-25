ALTER TYPE public.employee_event_type ADD VALUE IF NOT EXISTS 'EmployeeOperationBlockedByEPI';
ALTER TYPE public.employee_event_type ADD VALUE IF NOT EXISTS 'EmployeeOperationUnblockedByEPI';