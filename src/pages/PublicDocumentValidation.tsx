import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, Shield, Loader2, FileText } from 'lucide-react';

interface ValidationResult {
  valid: boolean;
  status: string;
  hash_verified: boolean;
  document_name?: string;
  signed_at?: string;
}

const PublicDocumentValidation: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // LGPD requester fields
  const [requesterName, setRequesterName] = useState('');
  const [requesterDocument, setRequesterDocument] = useState('');
  const [requesterPurpose, setRequesterPurpose] = useState('');

  const handleValidate = async () => {
    if (!token) return;
    setLoading(true);
    setSubmitted(true);

    try {
      const { data, error } = await supabase.functions.invoke('validate-document', {
        body: {
          token,
          requester_name: requesterName || null,
          requester_document: requesterDocument || null,
          requester_purpose: requesterPurpose || null,
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

  useEffect(() => {
    // Auto-validate if no LGPD fields required (quick check)
  }, [token]);

  const statusLabels: Record<string, string> = {
    success: 'Documento válido',
    invalid_token: 'Token não encontrado',
    expired: 'Token expirado',
    revoked: 'Documento revogado',
    hash_mismatch: 'Integridade comprometida',
    error: 'Erro na validação',
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Validação de Documento</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Verifique a autenticidade de um documento assinado digitalmente.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Token display */}
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Token de validação</p>
            <p className="font-mono text-sm break-all text-foreground">{token || '—'}</p>
          </div>

          {!submitted && (
            <>
              {/* LGPD fields */}
              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-xs text-muted-foreground font-medium">
                  Conforme LGPD, registramos os dados do solicitante. Preencha abaixo (opcional):
                </p>
                <div>
                  <Label htmlFor="name" className="text-xs">Nome</Label>
                  <Input
                    id="name"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="doc" className="text-xs">CPF / CNPJ</Label>
                  <Input
                    id="doc"
                    value={requesterDocument}
                    onChange={(e) => setRequesterDocument(e.target.value)}
                    placeholder="000.000.000-00"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="purpose" className="text-xs">Finalidade da consulta</Label>
                  <Textarea
                    id="purpose"
                    value={requesterPurpose}
                    onChange={(e) => setRequesterPurpose(e.target.value)}
                    placeholder="Ex: Verificação para processo admissional"
                    rows={2}
                    className="mt-1"
                  />
                </div>
              </div>

              <Button onClick={handleValidate} className="w-full" disabled={!token || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                Validar Documento
              </Button>
            </>
          )}

          {submitted && result && (
            <div className={`border rounded-lg p-4 space-y-3 ${result.valid ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'}`}>
              <div className="flex items-center gap-2">
                {result.valid ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="font-semibold text-foreground">
                  {statusLabels[result.status] ?? result.status}
                </span>
              </div>

              {result.valid && (
                <div className="space-y-1 text-sm text-muted-foreground">
                  {result.document_name && <p><strong>Documento:</strong> {result.document_name}</p>}
                  {result.signed_at && (
                    <p><strong>Assinado em:</strong> {new Date(result.signed_at).toLocaleString('pt-BR')}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-2">
                    <Badge variant="outline" className="text-primary border-primary/50 text-xs">
                      Hash SHA-256 ✓
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Integridade verificada
                    </Badge>
                  </div>
                </div>
              )}

              {!result.valid && (
                <p className="text-sm text-muted-foreground">
                  Este documento não pôde ser validado. Entre em contato com o emissor.
                </p>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => { setSubmitted(false); setResult(null); }}
                className="mt-2"
              >
                Nova consulta
              </Button>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-center">
            Os dados fornecidos são registrados conforme a Lei Geral de Proteção de Dados (LGPD).
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicDocumentValidation;
