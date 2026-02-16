/**
 * SalaryStructureView — Read Model
 *
 * Flat projection of an employee's active salary structure + rubrics,
 * consumed by the Workforce Intelligence Engine for salary analysis.
 */

export interface SalaryRubricView {
  rubric_id: string;
  codigo: string;
  nome: string;
  tipo: 'provento' | 'desconto';
  valor: number;
  percentual: number | null;
  integra_inss: boolean;
  integra_fgts: boolean;
  integra_irrf: boolean;
}

export interface SalaryStructureView {
  structure_id: string;
  employee_id: string;
  employee_name?: string;
  is_active: boolean;
  start_date: string;
  end_date?: string | null;
  total_proventos: number;
  total_descontos: number;
  salario_composto: number;
  rubric_count: number;
  rubrics: SalaryRubricView[];
}

/** Build a SalaryStructureView from raw salary_structures + salary_rubrics join */
export function toSalaryStructureView(raw: {
  id: string;
  employee_id: string;
  is_active: boolean;
  start_date: string;
  end_date?: string | null;
  employees?: { name: string } | null;
  salary_rubrics?: Array<{
    id: string;
    codigo: string;
    nome: string;
    tipo: string;
    valor: number;
    percentual: number | null;
    integra_inss: boolean;
    integra_fgts: boolean;
    integra_irrf: boolean;
  }>;
}): SalaryStructureView {
  const rubrics: SalaryRubricView[] = (raw.salary_rubrics ?? []).map(r => ({
    rubric_id: r.id,
    codigo: r.codigo,
    nome: r.nome,
    tipo: r.tipo as 'provento' | 'desconto',
    valor: r.valor,
    percentual: r.percentual,
    integra_inss: r.integra_inss,
    integra_fgts: r.integra_fgts,
    integra_irrf: r.integra_irrf,
  }));

  const totalProventos = rubrics.filter(r => r.tipo === 'provento').reduce((s, r) => s + r.valor, 0);
  const totalDescontos = rubrics.filter(r => r.tipo === 'desconto').reduce((s, r) => s + r.valor, 0);

  return {
    structure_id: raw.id,
    employee_id: raw.employee_id,
    employee_name: (raw.employees as any)?.name,
    is_active: raw.is_active,
    start_date: raw.start_date,
    end_date: raw.end_date,
    total_proventos: round(totalProventos),
    total_descontos: round(totalDescontos),
    salario_composto: round(totalProventos - totalDescontos),
    rubric_count: rubrics.length,
    rubrics,
  };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
