/**
 * PlatformInspectionExport — Exportação para fiscalização do MTE.
 *
 * Portaria 671/2021 Art. 83 — Disponibilização imediata.
 *
 * Permite exportar:
 *   - AFD (Arquivo Fonte de Dados)
 *   - AEJ (Arquivo Espelho de Jornada) + PDF
 *   - Log técnico REP-C
 *   - Versão do sistema
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  FileText, Download, Shield, Clock, AlertTriangle,
  CheckCircle, FileCode, History, Server, Hash,
} from 'lucide-react';
import { getREPCComplianceLayer } from '@/domains/worktime-compliance-engine/repc';
import { toast } from 'sonner';

export default function PlatformInspectionExport() {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [inspectorCpf, setInspectorCpf] = useState('');
  const [inspectionNumber, setInspectionNumber] = useState('');
  const [generating, setGenerating] = useState(false);
  const [afdPreview, setAfdPreview] = useState('');
  const [aejPreview, setAejPreview] = useState('');
  const [logPreview, setLogPreview] = useState('');

  const repc = getREPCComplianceLayer();
  const currentVersion = repc.versions.getCurrent();
  const systemId = repc.systemId.getIdentification('current');
  const versionHistory = repc.versions.getHistory();

  const handleGenerateAFD = async () => {
    if (!periodStart || !periodEnd) {
      toast.error('Informe o período de exportação');
      return;
    }
    setGenerating(true);
    try {
      const afd = repc.afd.generateFromEntries(
        {
          cnpj_cpf: systemId.employer_cnpj || '00.000.000/0001-00',
          cei_caepf: systemId.employer_cei_caepf || '',
          razao_social: systemId.employer_razao_social || 'Empresa',
          numero_registro_rep: systemId.compliance_certificate_id || '',
          data_inicio: periodStart.replace(/-/g, '').split('').reverse().join(''),
          data_fim: periodEnd.replace(/-/g, '').split('').reverse().join(''),
        },
        [], // In production: fetch from ImmutableTimeLedger
        [],
      );
      const validation = repc.afd.validate(afd);
      const text = repc.afd.toText(afd);
      setAfdPreview(text);

      repc.logExportGenerated('current', 'AFD', inspectorCpf || 'system');

      if (validation.valid) {
        toast.success('AFD gerado com sucesso');
      } else {
        toast.warning(`AFD gerado com ${validation.errors.length} avisos`);
      }
    } catch (err) {
      toast.error('Erro ao gerar AFD');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAEJ = async () => {
    if (!periodStart || !periodEnd) {
      toast.error('Informe o período de exportação');
      return;
    }
    setGenerating(true);
    try {
      const aej = repc.aej.generate(
        systemId.employer_cnpj || '00.000.000/0001-00',
        systemId.employer_razao_social || 'Empresa',
        periodStart,
        periodEnd,
        [], // In production: fetch from ImmutableTimeLedger
        inspectorCpf || 'system',
      );
      const text = repc.aej.toText(aej);
      setAejPreview(text);

      repc.logExportGenerated('current', 'AEJ', inspectorCpf || 'system');
      toast.success('AEJ gerado com sucesso');
    } catch (err) {
      toast.error('Erro ao gerar AEJ');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAEJPdf = async () => {
    if (!periodStart || !periodEnd) {
      toast.error('Informe o período');
      return;
    }
    setGenerating(true);
    try {
      const aej = repc.aej.generate(
        systemId.employer_cnpj || '00.000.000/0001-00',
        systemId.employer_razao_social || 'Empresa',
        periodStart,
        periodEnd,
        [],
        inspectorCpf || 'system',
      );
      const blob = await repc.aej.toPdf(aej);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AEJ_${periodStart}_${periodEnd}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      repc.logExportGenerated('current', 'AEJ_PDF', inspectorCpf || 'system');
      toast.success('PDF do AEJ baixado');
    } catch (err) {
      toast.error('Erro ao gerar PDF do AEJ');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportLog = () => {
    const entries = repc.technicalLog.getEntries(
      'current',
      periodStart || '2020-01-01',
      periodEnd || '2099-12-31',
    );
    const lines = entries.map(e =>
      `[${e.timestamp}] ${e.event_type} | ${e.description} | hash=${e.integrity_hash} | prev=${e.previous_hash ?? 'genesis'}`,
    );
    setLogPreview(lines.join('\n') || 'Nenhum registro no período.');
    repc.logExportGenerated('current', 'LOG_TECNICO', inspectorCpf || 'system');
    toast.success('Log técnico exportado');
  };

  const handleVerifyIntegrity = () => {
    const result = repc.verifyIntegrity('current');
    if (result.technicalLog.valid) {
      toast.success('Cadeia de integridade íntegra ✓');
    } else {
      toast.error(`Cadeia de integridade corrompida em: ${result.technicalLog.broken_at}`);
    }
  };

  const downloadText = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Exportação para Fiscalização — REP-C
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Portaria MTP 671/2021 · Art. 83 — Disponibilização imediata ao auditor fiscal
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleVerifyIntegrity}>
          <CheckCircle className="h-4 w-4 mr-2" />
          Verificar Integridade
        </Button>
      </div>

      {/* Period + Inspector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Parâmetros da Exportação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="period-start">Período Início</Label>
              <Input
                id="period-start"
                type="date"
                value={periodStart}
                onChange={e => setPeriodStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="period-end">Período Fim</Label>
              <Input
                id="period-end"
                type="date"
                value={periodEnd}
                onChange={e => setPeriodEnd(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="inspector-cpf">CPF do Auditor Fiscal</Label>
              <Input
                id="inspector-cpf"
                placeholder="000.000.000-00"
                value={inspectorCpf}
                onChange={e => setInspectorCpf(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="inspection-number">Nº Auto de Infração</Label>
              <Input
                id="inspection-number"
                placeholder="Opcional"
                value={inspectionNumber}
                onChange={e => setInspectionNumber(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="afd" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="afd" className="flex items-center gap-1">
            <FileCode className="h-3.5 w-3.5" />
            AFD
          </TabsTrigger>
          <TabsTrigger value="aej" className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            AEJ
          </TabsTrigger>
          <TabsTrigger value="log" className="flex items-center gap-1">
            <History className="h-3.5 w-3.5" />
            Log Técnico
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-1">
            <Server className="h-3.5 w-3.5" />
            Sistema
          </TabsTrigger>
        </TabsList>

        {/* AFD */}
        <TabsContent value="afd">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Arquivo Fonte de Dados (AFD)</CardTitle>
              <CardDescription>
                Portaria 671/2021 Art. 81-84 — Layout posicional oficial com todos os registros de ponto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={handleGenerateAFD} disabled={generating}>
                  <FileCode className="h-4 w-4 mr-2" />
                  Gerar AFD
                </Button>
                {afdPreview && (
                  <Button
                    variant="outline"
                    onClick={() => downloadText(afdPreview, `AFD_${periodStart}_${periodEnd}.txt`)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar .txt
                  </Button>
                )}
              </div>
              {afdPreview && (
                <ScrollArea className="h-64 border rounded-md p-3 bg-muted/30">
                  <pre className="text-xs font-mono whitespace-pre-wrap">{afdPreview}</pre>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AEJ */}
        <TabsContent value="aej">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Arquivo Espelho de Jornada (AEJ)</CardTitle>
              <CardDescription>
                Portaria 671/2021 Art. 85-88 — Espelho mensal com entradas, saídas, intervalos, extras e banco de horas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={handleGenerateAEJ} disabled={generating}>
                  <FileText className="h-4 w-4 mr-2" />
                  Gerar AEJ (Texto)
                </Button>
                <Button variant="secondary" onClick={handleGenerateAEJPdf} disabled={generating}>
                  <Download className="h-4 w-4 mr-2" />
                  Gerar AEJ (PDF)
                </Button>
                {aejPreview && (
                  <Button
                    variant="outline"
                    onClick={() => downloadText(aejPreview, `AEJ_${periodStart}_${periodEnd}.txt`)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar .txt
                  </Button>
                )}
              </div>
              {aejPreview && (
                <ScrollArea className="h-64 border rounded-md p-3 bg-muted/30">
                  <pre className="text-xs font-mono whitespace-pre-wrap">{aejPreview}</pre>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Log Técnico */}
        <TabsContent value="log">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Log Técnico REP-C</CardTitle>
              <CardDescription>
                Portaria 671/2021 Art. 75-77 — Log append-only com chain de integridade
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={handleExportLog} disabled={generating}>
                  <History className="h-4 w-4 mr-2" />
                  Exportar Log
                </Button>
                {logPreview && (
                  <Button
                    variant="outline"
                    onClick={() => downloadText(logPreview, `LOG_REPC_${periodStart}_${periodEnd}.txt`)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar .txt
                  </Button>
                )}
              </div>
              {logPreview && (
                <ScrollArea className="h-64 border rounded-md p-3 bg-muted/30">
                  <pre className="text-xs font-mono whitespace-pre-wrap">{logPreview}</pre>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sistema */}
        <TabsContent value="system">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Identificação do Sistema
                </CardTitle>
                <CardDescription>Art. 89-92 — Dados do REP-C</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Software</span>
                  <span className="font-medium">{systemId.software_name}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Versão</span>
                  <Badge variant="outline">{systemId.software_version}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Desenvolvedor</span>
                  <span className="font-medium">{systemId.developer_name}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CNPJ Desenvolvedor</span>
                  <span className="font-mono text-xs">{systemId.developer_cnpj}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data de Implantação</span>
                  <span>{systemId.deployment_date}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Histórico de Versões
                </CardTitle>
                <CardDescription>Art. 78-80 — Rastreabilidade de atualizações</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-3">
                    {versionHistory.map(v => (
                      <div key={v.id} className="border rounded-md p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-medium text-sm">v{v.version}</span>
                          <div className="flex items-center gap-2">
                            {v.is_current && <Badge className="text-xs">Atual</Badge>}
                            <Badge
                              variant={v.compliance_level === 'full' ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {v.compliance_level === 'full' ? 'Conforme' : v.compliance_level}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{v.changelog}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>Publicado: {v.release_date}</span>
                          <span className="font-mono">Hash: {v.content_hash}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Compliance footer */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground">
            <strong>Aviso legal:</strong> Os arquivos gerados por este sistema atendem ao formato oficial da
            Portaria MTP 671/2021. A disponibilização ao auditor fiscal é obrigatória e deve ser imediata
            conforme Art. 83. Todos os exports são registrados no log técnico do REP-C.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
