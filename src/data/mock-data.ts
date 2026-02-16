import { Employee, Position, Department, SalaryHistory } from '@/types/hr';

export const departments: Department[] = [
  { id: '1', name: 'Engenharia', employeeCount: 12, budget: 450000 },
  { id: '2', name: 'Marketing', employeeCount: 6, budget: 180000 },
  { id: '3', name: 'Recursos Humanos', employeeCount: 4, budget: 120000 },
  { id: '4', name: 'Financeiro', employeeCount: 5, budget: 150000 },
  { id: '5', name: 'Comercial', employeeCount: 8, budget: 280000 },
];

export const positions: Position[] = [
  { id: '1', title: 'Engenheiro de Software Sênior', department: 'Engenharia', level: 'Sênior', baseSalary: 12000, maxSalary: 18000, employeeCount: 4 },
  { id: '2', title: 'Engenheiro de Software Pleno', department: 'Engenharia', level: 'Pleno', baseSalary: 8000, maxSalary: 12000, employeeCount: 5 },
  { id: '3', title: 'Analista de Marketing', department: 'Marketing', level: 'Pleno', baseSalary: 5000, maxSalary: 8000, employeeCount: 3 },
  { id: '4', title: 'Gerente de RH', department: 'Recursos Humanos', level: 'Gerência', baseSalary: 10000, maxSalary: 15000, employeeCount: 1 },
  { id: '5', title: 'Analista Financeiro', department: 'Financeiro', level: 'Pleno', baseSalary: 6000, maxSalary: 10000, employeeCount: 3 },
  { id: '6', title: 'Executivo de Vendas', department: 'Comercial', level: 'Pleno', baseSalary: 5000, maxSalary: 9000, employeeCount: 5 },
  { id: '7', title: 'Diretor de Engenharia', department: 'Engenharia', level: 'Diretoria', baseSalary: 20000, maxSalary: 30000, employeeCount: 1 },
  { id: '8', title: 'Coordenador de Marketing', department: 'Marketing', level: 'Coordenação', baseSalary: 7000, maxSalary: 11000, employeeCount: 1 },
];

export const employees: Employee[] = [
  { id: '1', name: 'Ana Carolina Silva', email: 'ana.silva@empresa.com', phone: '(11) 98765-4321', department: 'Engenharia', positionId: '1', positionTitle: 'Engenheiro de Software Sênior', hireDate: '2021-03-15', status: 'active', baseSalary: 12000, currentSalary: 15000 },
  { id: '2', name: 'Bruno Costa Santos', email: 'bruno.santos@empresa.com', phone: '(11) 91234-5678', department: 'Engenharia', positionId: '2', positionTitle: 'Engenheiro de Software Pleno', hireDate: '2022-07-01', status: 'active', baseSalary: 8000, currentSalary: 9500 },
  { id: '3', name: 'Carla Ferreira Lima', email: 'carla.lima@empresa.com', phone: '(21) 99876-5432', department: 'Marketing', positionId: '3', positionTitle: 'Analista de Marketing', hireDate: '2023-01-10', status: 'active', baseSalary: 5000, currentSalary: 5500 },
  { id: '4', name: 'Diego Oliveira Martins', email: 'diego.martins@empresa.com', phone: '(31) 98765-1234', department: 'Financeiro', positionId: '5', positionTitle: 'Analista Financeiro', hireDate: '2020-11-20', status: 'active', baseSalary: 6000, currentSalary: 8500 },
  { id: '5', name: 'Elena Rodrigues Souza', email: 'elena.souza@empresa.com', phone: '(41) 91234-9876', department: 'Recursos Humanos', positionId: '4', positionTitle: 'Gerente de RH', hireDate: '2019-05-03', status: 'active', baseSalary: 10000, currentSalary: 14000 },
  { id: '6', name: 'Fernando Almeida Pereira', email: 'fernando.pereira@empresa.com', phone: '(51) 98765-6789', department: 'Comercial', positionId: '6', positionTitle: 'Executivo de Vendas', hireDate: '2022-09-12', status: 'on_leave', baseSalary: 5000, currentSalary: 6000 },
  { id: '7', name: 'Gabriela Nascimento', email: 'gabriela.nascimento@empresa.com', phone: '(61) 91234-3456', department: 'Engenharia', positionId: '7', positionTitle: 'Diretor de Engenharia', hireDate: '2018-02-28', status: 'active', baseSalary: 20000, currentSalary: 27000 },
  { id: '8', name: 'Henrique Barbosa', email: 'henrique.barbosa@empresa.com', phone: '(71) 98765-2345', department: 'Engenharia', positionId: '1', positionTitle: 'Engenheiro de Software Sênior', hireDate: '2021-08-16', status: 'active', baseSalary: 12000, currentSalary: 14500 },
  { id: '9', name: 'Isabella Mendes', email: 'isabella.mendes@empresa.com', phone: '(81) 91234-7890', department: 'Marketing', positionId: '8', positionTitle: 'Coordenador de Marketing', hireDate: '2020-04-05', status: 'active', baseSalary: 7000, currentSalary: 9000 },
  { id: '10', name: 'João Pedro Araújo', email: 'joao.araujo@empresa.com', phone: '(91) 98765-8901', department: 'Comercial', positionId: '6', positionTitle: 'Executivo de Vendas', hireDate: '2023-06-20', status: 'inactive', baseSalary: 5000, currentSalary: 5000 },
];

export const salaryHistory: SalaryHistory[] = [
  { id: '1', employeeId: '1', previousSalary: 12000, newSalary: 13500, reason: 'Promoção por desempenho', effectiveDate: '2022-01-01', approvedBy: 'Elena Rodrigues' },
  { id: '2', employeeId: '1', previousSalary: 13500, newSalary: 15000, reason: 'Reajuste anual', effectiveDate: '2023-01-01', approvedBy: 'Elena Rodrigues' },
  { id: '3', employeeId: '4', previousSalary: 6000, newSalary: 7200, reason: 'Reajuste anual', effectiveDate: '2022-01-01', approvedBy: 'Elena Rodrigues' },
  { id: '4', employeeId: '4', previousSalary: 7200, newSalary: 8500, reason: 'Promoção', effectiveDate: '2023-06-01', approvedBy: 'Elena Rodrigues' },
  { id: '5', employeeId: '5', previousSalary: 10000, newSalary: 12000, reason: 'Reajuste + bônus', effectiveDate: '2021-01-01', approvedBy: 'Diretoria' },
  { id: '6', employeeId: '5', previousSalary: 12000, newSalary: 14000, reason: 'Reajuste anual', effectiveDate: '2023-01-01', approvedBy: 'Diretoria' },
  { id: '7', employeeId: '7', previousSalary: 20000, newSalary: 24000, reason: 'Promoção a Diretora', effectiveDate: '2020-01-01', approvedBy: 'Diretoria' },
  { id: '8', employeeId: '7', previousSalary: 24000, newSalary: 27000, reason: 'Reajuste anual', effectiveDate: '2023-01-01', approvedBy: 'Diretoria' },
];
