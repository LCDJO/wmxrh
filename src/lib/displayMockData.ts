/**
 * Shared mock data builder for TV Display previews and demo mode.
 *
 * Rich mock data aligned with FleetDashboard + Compliance modules.
 */
import type { DisplayData } from '@/components/tv/TVComponents';

const DRIVERS = [
  'João Silva', 'Maria Santos', 'Carlos Lima', 'Ana Costa', 'Pedro Alves',
  'Fernanda Reis', 'Lucas Mendes', 'Roberto Dias', 'Juliana Ferreira', 'Rafael Oliveira',
  'Patrícia Gomes', 'Bruno Souza',
];

const PLATES = [
  'ABC-1234', 'DEF-5678', 'GHI-9012', 'JKL-3456', 'MNO-7890',
  'PQR-1122', 'STU-3344', 'VWX-5566', 'YZA-7788', 'BCD-9900',
  'EFG-2233', 'HIJ-4455',
];

export function buildDisplayMockData(tipo: string): DisplayData {
  const baseLat = -23.55;
  const baseLng = -46.63;

  // Generate 12 vehicles around São Paulo
  const live_positions = DRIVERS.map((_, i) => {
    const angle = (i / DRIVERS.length) * Math.PI * 2;
    const radius = 0.02 + (((i * 7 + 3) % 10) / 10) * 0.06;
    const speed = i % 4 === 0 ? 0 : [35, 55, 78, 92, 42, 110, 65, 48, 88, 15, 70, 0][i];
    return {
      device_id: PLATES[i],
      driver: DRIVERS[i],
      lat: baseLat + Math.cos(angle) * radius,
      lng: baseLng + Math.sin(angle) * radius,
      speed,
      heading: Math.floor(angle * (180 / Math.PI)) % 360,
      status: speed > 80 ? 'speeding' : speed > 5 ? 'moving' : 'stopped',
      ignition: speed > 0,
    };
  });

  return {
    display: { id: 'demo', nome: 'Demonstração', tipo, rotacao_automatica: true, intervalo_rotacao: 30, layout_config: {} },
    timestamp: new Date().toISOString(),
    workforce: {
      total: 128, active: 112, inactive: 16,
      by_department: { Operações: 45, Logística: 30, Administrativo: 20, Manutenção: 17, Campo: 16 },
    },
    fleet_events: [
      { id: 'fe1', tipo: 'excesso_velocidade', descricao: `${PLATES[0]} a 92km/h (limite: 80) — ${DRIVERS[0]}`, severidade: 'high', severity: 'high', created_at: new Date(Date.now() - 120000).toISOString() },
      { id: 'fe2', tipo: 'freada_brusca', descricao: `Freada brusca — ${PLATES[1]} (${DRIVERS[1]})`, severidade: 'medium', severity: 'medium', created_at: new Date(Date.now() - 300000).toISOString() },
      { id: 'fe3', tipo: 'desvio_rota', descricao: `Desvio de rota — ${PLATES[2]} (${DRIVERS[2]})`, severidade: 'low', severity: 'low', created_at: new Date(Date.now() - 600000).toISOString() },
      { id: 'fe4', tipo: 'excesso_velocidade', descricao: `${PLATES[3]} a 110km/h zona urbana — ${DRIVERS[3]}`, severidade: 'critical', severity: 'critical', created_at: new Date(Date.now() - 60000).toISOString() },
      { id: 'fe5', tipo: 'aceleracao_brusca', descricao: `Aceleração brusca — ${PLATES[4]} (${DRIVERS[4]})`, severidade: 'medium', severity: 'medium', created_at: new Date(Date.now() - 900000).toISOString() },
      { id: 'fe6', tipo: 'violacao_geofence', descricao: `Saída de perímetro — ${PLATES[6]} (${DRIVERS[6]})`, severidade: 'high', severity: 'high', created_at: new Date(Date.now() - 1500000).toISOString() },
      { id: 'fe7', tipo: 'uso_fora_horario', descricao: `Uso após expediente — ${PLATES[5]} (${DRIVERS[5]})`, severidade: 'high', severity: 'high', created_at: new Date(Date.now() - 2100000).toISOString() },
      { id: 'fe8', tipo: 'excesso_velocidade', descricao: `${PLATES[7]} a 88km/h (limite: 60) — ${DRIVERS[7]}`, severidade: 'high', severity: 'high', created_at: new Date(Date.now() - 3000000).toISOString() },
      { id: 'fe9', tipo: 'desvio_rota', descricao: `Desvio não autorizado — ${PLATES[8]} (${DRIVERS[8]})`, severidade: 'medium', severity: 'medium', created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 'fe10', tipo: 'violacao_geofence', descricao: `Entrada área restrita — ${PLATES[10]} (${DRIVERS[10]})`, severidade: 'critical', severity: 'critical', created_at: new Date(Date.now() - 4200000).toISOString() },
    ],
    live_positions,
    speed_alerts: [
      { id: 'sa1', device_id: PLATES[3], speed: 110, limit: 60, driver: DRIVERS[3], created_at: new Date(Date.now() - 60000).toISOString() },
      { id: 'sa2', device_id: PLATES[0], speed: 92, limit: 80, driver: DRIVERS[0], created_at: new Date(Date.now() - 120000).toISOString() },
      { id: 'sa3', device_id: PLATES[7], speed: 88, limit: 60, driver: DRIVERS[7], created_at: new Date(Date.now() - 240000).toISOString() },
      { id: 'sa4', device_id: PLATES[9], speed: 75, limit: 60, driver: DRIVERS[9], created_at: new Date(Date.now() - 480000).toISOString() },
      { id: 'sa5', device_id: PLATES[4], speed: 95, limit: 80, driver: DRIVERS[4], created_at: new Date(Date.now() - 600000).toISOString() },
    ],
    nr_overdue_exams: [
      { id: 'nr1', employee_name: DRIVERS[0], exam_type: 'NR-35 (Altura)', due_date: new Date(Date.now() - 86400000).toISOString() },
      { id: 'nr2', employee_name: DRIVERS[4], exam_type: 'NR-10 (Eletricidade)', due_date: new Date(Date.now() - 172800000).toISOString() },
      { id: 'nr3', employee_name: DRIVERS[3], exam_type: 'NR-33 (Espaço Confinado)', due_date: new Date(Date.now() - 259200000).toISOString() },
      { id: 'nr4', employee_name: DRIVERS[8], exam_type: 'ASO Periódico', due_date: new Date(Date.now() - 345600000).toISOString() },
    ],
    active_blocks: [
      { id: 'bl1', employee_name: DRIVERS[1], reason: 'ASO vencido há 5 dias', blocked_at: new Date(Date.now() - 172800000).toISOString() },
      { id: 'bl2', employee_name: DRIVERS[7], reason: 'NR-35 expirado', blocked_at: new Date(Date.now() - 86400000).toISOString() },
      { id: 'bl3', employee_name: DRIVERS[10], reason: 'CNH categoria incompatível', blocked_at: new Date(Date.now() - 43200000).toISOString() },
    ],
    sst_summary: { overdue_count: 12, critical_overdue: 4, active_blocks_count: 3 },
    recent_warnings: [
      { id: 'w1', employee_name: DRIVERS[2], tipo: 'verbal', motivo: 'Uso indevido de EPI em campo', created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 'w2', employee_name: DRIVERS[5], tipo: 'escrita', motivo: 'Excesso de velocidade reincidente (3ª ocorrência)', created_at: new Date(Date.now() - 7200000).toISOString() },
      { id: 'w3', employee_name: DRIVERS[6], tipo: 'verbal', motivo: 'Desvio de rota não autorizado', created_at: new Date(Date.now() - 14400000).toISOString() },
      { id: 'w4', employee_name: DRIVERS[0], tipo: 'escrita', motivo: 'Uso do veículo fora do horário permitido', created_at: new Date(Date.now() - 28800000).toISOString() },
      { id: 'w5', employee_name: DRIVERS[9], tipo: 'suspensao', motivo: 'Acúmulo de 3 advertências em 60 dias', created_at: new Date(Date.now() - 43200000).toISOString() },
    ],
    compliance_incidents: [
      { id: 'ci1', tipo: 'infracao_transito', descricao: `Multa por avanço de sinal — ${PLATES[2]}`, severity: 'high', created_at: new Date(Date.now() - 1800000).toISOString() },
      { id: 'ci2', tipo: 'documentacao', descricao: `CNH vencida — ${DRIVERS[10]} (motorista ativo)`, severity: 'critical', created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 'ci3', tipo: 'acidente', descricao: `Colisão leve no pátio — ${PLATES[11]}`, severity: 'high', created_at: new Date(Date.now() - 7200000).toISOString() },
      { id: 'ci4', tipo: 'fiscalizacao', descricao: `Autuação por excesso de peso — ${PLATES[8]}`, severity: 'medium', created_at: new Date(Date.now() - 14400000).toISOString() },
      { id: 'ci5', tipo: 'infracao_transito', descricao: `Radar eletrônico 95km/h (zona 60) — ${PLATES[0]}`, severity: 'high', created_at: new Date(Date.now() - 21600000).toISOString() },
    ],
    compliance_summary: { total_warnings: 22, pending_incidents: 5, critical_incidents: 3 },
    executive: {
      operational_score: 72,
      legal_risk: { score: 42, level: 'medium' },
      projected_cost_brl: 67500,
      workforce_total: 128,
      active_devices: 12,
      total_violations: 18,
      total_warnings: 22,
      total_blocks: 3,
    },
    risk_heatmap: {
      Operações: { fleet: 6, sst: 4, compliance: 3, workforce: 45, total: 13, headcount: 45 },
      Logística: { fleet: 8, sst: 2, compliance: 4, workforce: 30, total: 14, headcount: 30 },
      Manutenção: { fleet: 1, sst: 7, compliance: 1, workforce: 17, total: 9, headcount: 17 },
      Administrativo: { fleet: 0, sst: 1, compliance: 0, workforce: 20, total: 1, headcount: 20 },
      Campo: { fleet: 5, sst: 5, compliance: 3, workforce: 16, total: 13, headcount: 16 },
    },
    critical_alerts: [
      { id: 'ca1', message: `CNH vencida — ${DRIVERS[10]} em operação ativa`, severity: 'critical', created_at: new Date(Date.now() - 1800000).toISOString() },
      { id: 'ca2', message: `${PLATES[3]}: 110km/h em zona urbana (limite 60)`, severity: 'critical', created_at: new Date(Date.now() - 60000).toISOString() },
      { id: 'ca3', message: `3 bloqueios SST ativos — verificação imediata`, severity: 'critical', created_at: new Date(Date.now() - 300000).toISOString() },
    ],
  };
}
