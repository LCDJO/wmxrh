import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, XCircle, Shield, Loader2, FileText, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface BlockchainProofData {
  hash_sha256: string;
  blockchain_network: string;
  transaction_hash: string | null;
  block_number: number | null;
  timestamp_blockchain: string;
  status: string;
  verification_url: string | null;
}

interface ValidationResult {
  valid: boolean;
  status: string;
  hash_verified: boolean;
  document_name?: string;
  signed_at?: string;
  document_hash?: string;
  versao?: number;
  signer_name?: string;
  blockchain_proof?: BlockchainProofData;
}

const PublicDocumentValidation: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // LGPD mandatory fields
  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [requesterPurpose, setRequesterPurpose] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!requesterName.trim()) e.name = 'Nome completo é obrigatório';
    if (!requesterEmail.trim()) e.email = 'E-mail é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail.trim())) e.email = 'E-mail inválido';
    if (!requesterPurpose.trim()) e.purpose = 'Finalidade é obrigatória';
    if (!privacyAccepted) e.privacy = 'Você deve aceitar a política de privacidade';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleValidate = async () => {
    if (!token || !validate()) return;
    setLoading(true);
    setSubmitted(true);

    try {
      const { data, error } = await supabase.functions.invoke('validate-document', {
        body: {
          token,
          requester_name: requesterName.trim(),
          requester_email: requesterEmail.trim(),
          requester_purpose: requesterPurpose.trim(),
          privacy_accepted: true,
        },
      });

      if (error) {
        setResult({ valid: false, status: 'error', hash_verified: false });
      } else {
        setResult(data as ValidationResult);
      }
    } catch {
      setResult({ valid: false, status: 'error', hash_verified: false });
    } finally {
      setLoading(false);
    }
  };

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    toast.success('Hash copiado para a área de transferência');
  };

  const statusLabels: Record<string, string> = {
    success: 'Documento autêntico e íntegro',
    invalid_token: 'Token de validação não encontrado',
    expired: 'Token de validação expirado',
    revoked: 'Documento foi revogado',
    hash_mismatch: 'Integridade do documento comprometida',
    error: 'Erro interno na validação',
  };

  const bp = result?.blockchain_proof;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Validação de Documento Digital</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Verifique a autenticidade e integridade de um documento assinado digitalmente.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Token display */}
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Token de validação</p>
            <p className="font-mono text-xs break-all text-foreground">{token || '—'}</p>
          </div>

          {!submitted && (
            <>
              {/* LGPD mandatory form */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <p className="text-xs font-semibold text-foreground">
                    Identificação obrigatória (LGPD)
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), todos os acessos a documentos são registrados.
                </p>

                <div>
                  <Label htmlFor="name" className="text-xs">Nome completo *</Label>
                  <Input
                    id="name"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="mt-1"
                    maxLength={100}
                  />
                  {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                </div>

                <div>
                  <Label htmlFor="email" className="text-xs">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={requesterEmail}
                    onChange={(e) => setRequesterEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="mt-1"
                    maxLength={255}
                  />
                  {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                </div>

                <div>
                  <Label htmlFor="purpose" className="text-xs">Finalidade da consulta *</Label>
                  <Textarea
                    id="purpose"
                    value={requesterPurpose}
                    onChange={(e) => setRequesterPurpose(e.target.value)}
                    placeholder="Ex: Verificação para processo admissional"
                    rows={2}
                    className="mt-1"
                    maxLength={500}
                  />
                  {errors.purpose && <p className="text-xs text-destructive mt-1">{errors.purpose}</p>}
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <Checkbox
                    id="privacy"
                    checked={privacyAccepted}
                    onCheckedChange={(v) => setPrivacyAccepted(v === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="privacy" className="text-xs text-muted-foreground leading-tight cursor-pointer">
                    Declaro estar ciente de que meus dados serão registrados para fins de auditoria conforme a LGPD (Lei 13.709/2018) e a política de privacidade do emissor. *
                  </Label>
                </div>
                {errors.privacy && <p className="text-xs text-destructive">{errors.privacy}</p>}
              </div>

              <Button onClick={handleValidate} className="w-full" disabled={!token || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                Validar Documento
              </Button>
            </>
          )}

          {submitted && loading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Verificando autenticidade...</p>
            </div>
          )}

          {submitted && !loading && result && (
            <div className={`border rounded-lg overflow-hidden ${result.valid ? 'border-primary/30' : 'border-destructive/30'}`}>
              {/* Status banner */}
              <div className={`px-4 py-3 flex items-center gap-3 ${result.valid ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                {result.valid ? (
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive shrink-0" />
                )}
                <div>
                  <p className={`font-bold text-sm ${result.valid ? 'text-primary' : 'text-destructive'}`}>
                    {result.valid ? 'Documento Autêntico' : 'Documento Inválido'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {statusLabels[result.status] ?? result.status}
                  </p>
                </div>
              </div>

              {result.valid && (
                <div className="p-4 space-y-4">
                  {/* Document details */}
                  <div className="space-y-2.5 text-sm">
                    {result.document_name && (
                      <div className="flex justify-between items-start gap-4">
                        <span className="text-muted-foreground shrink-0">📄 Documento</span>
                        <span className="font-medium text-foreground text-right">{result.document_name}</span>
                      </div>
                    )}
                    {result.signer_name && (
                      <div className="flex justify-between items-start gap-4">
                        <span className="text-muted-foreground shrink-0">👤 Colaborador</span>
                        <span className="font-medium text-foreground text-right">{result.signer_name}</span>
                      </div>
                    )}
                    {result.signed_at && (
                      <div className="flex justify-between items-start gap-4">
                        <span className="text-muted-foreground shrink-0">📅 Data de assinatura</span>
                        <span className="font-medium text-foreground text-right">
                          {new Date(result.signed_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    )}
                    {result.versao && (
                      <div className="flex justify-between items-start gap-4">
                        <span className="text-muted-foreground shrink-0">🔢 Versão</span>
                        <span className="font-medium text-foreground">v{result.versao}</span>
                      </div>
                    )}
                  </div>

                  {/* SHA-256 Hash */}
                  {result.document_hash && (
                    <div className="bg-muted rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground">🔒 Hash SHA-256</p>
                        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => copyHash(result.document_hash!)}>
                          <Copy className="h-3 w-3 mr-1" />
                          <span className="text-xs">Copiar</span>
                        </Button>
                      </div>
                      <p className="font-mono text-[10px] break-all text-muted-foreground leading-relaxed">
                        {result.document_hash}
                      </p>
                    </div>
                  )}

                  {/* ═══ BLOCKCHAIN PROOF SECTION ═══ */}
                  {bp && (
                    <div className="border border-primary/20 rounded-lg overflow-hidden">
                      <div className="bg-primary/5 px-3 py-2 flex items-center gap-2">
                        <span className="text-sm">⛓</span>
                        <p className="text-xs font-semibold text-foreground">Prova Blockchain</p>
                        <Badge variant="outline" className="ml-auto text-[10px] border-primary/50 text-primary">
                          {bp.status === 'confirmed' ? '✓ Confirmado' : bp.status}
                        </Badge>
                      </div>
                      <div className="p-3 space-y-2.5 text-xs">
                        {/* Hash SHA-256 */}
                        <div>
                          <p className="text-muted-foreground mb-0.5">Hash SHA-256</p>
                          <div className="flex items-center gap-1">
                            <p className="font-mono text-[10px] break-all text-foreground leading-relaxed flex-1">
                              {bp.hash_sha256}
                            </p>
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={() => copyHash(bp.hash_sha256)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Blockchain Network */}
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Rede</span>
                          <span className="font-medium text-foreground">{bp.blockchain_network}</span>
                        </div>

                        {/* Transaction Hash */}
                        {bp.transaction_hash && (
                          <div>
                            <p className="text-muted-foreground mb-0.5">Transaction Hash</p>
                            <div className="flex items-center gap-1">
                              <p className="font-mono text-[10px] break-all text-foreground leading-relaxed flex-1">
                                {bp.transaction_hash}
                              </p>
                              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={() => copyHash(bp.transaction_hash!)}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Block Number */}
                        {bp.block_number != null && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Bloco</span>
                            <span className="font-mono font-medium text-foreground">#{bp.block_number.toLocaleString('pt-BR')}</span>
                          </div>
                        )}

                        {/* Timestamp */}
                        {bp.timestamp_blockchain && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Timestamp</span>
                            <span className="font-medium text-foreground">
                              {new Date(bp.timestamp_blockchain).toLocaleString('pt-BR')}
                            </span>
                          </div>
                        )}

                        {/* Explorer Link */}
                        {bp.verification_url && (
                          <a
                            href={bp.verification_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-primary hover:underline pt-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span className="text-xs font-medium">Verificar no Explorer</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Status badges */}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-primary border-primary/50 text-xs">
                      ✓ Assinatura válida
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      ✓ Hash verificado
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      ✓ LGPD registrado
                    </Badge>
                    {bp?.status === 'confirmed' && (
                      <Badge variant="outline" className="text-primary border-primary/50 text-xs">
                        ⛓ Blockchain confirmado
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {!result.valid && (
                <div className="p-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Este documento não pôde ser validado. Entre em contato com o emissor para obter um token válido.
                  </p>
                  {result.status === 'hash_mismatch' && (
                    <p className="text-xs text-destructive font-medium">
                      ⚠️ O conteúdo do documento foi alterado após a assinatura. Este documento pode ter sido adulterado.
                    </p>
                  )}
                </div>
              )}

              <div className="p-4 pt-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setSubmitted(false); setResult(null); }}
                >
                  Nova consulta
                </Button>
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            Todos os acessos são registrados conforme a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).
            Os dados informados serão utilizados exclusivamente para fins de auditoria e rastreabilidade.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicDocumentValidation;
