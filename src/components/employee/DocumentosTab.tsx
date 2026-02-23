/**
 * DocumentosTab — "Documentos do Colaborador"
 *
 * Lists all signed documents from document_vault.
 * Supports filtering by tipo_documento.
 */

import { useState } from 'react';
import { FileText, Download, CheckCircle2, XCircle, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDocumentVault } from '@/domains/hooks';
import { documentVaultService, type DocumentVaultRecord } from '@/domains/employee-agreement/document-vault';
import { useToast } from '@/hooks/use-toast';

const tipoLabels: Record<string, string> = {
  termo: 'Termo / Acordo',
  contrato: 'Contrato',
  aditivo: 'Aditivo',
  atestado: 'Atestado',
  certificado: 'Certificado',
  outro: 'Outro',
};

interface Props {
  employeeId: string;
}

export function DocumentosTab({ employeeId }: Props) {
  const { data: documents = [], isLoading } = useDocumentVault(employeeId);
  const { toast } = useToast();
  const [tipoFilter, setTipoFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = documents.filter(doc => {
    if (tipoFilter !== 'all' && doc.tipo_documento !== tipoFilter) return false;
    if (search && !doc.nome_documento.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDownload = async (urlArquivo: string, nomeDocumento: string) => {
    try {
      const signedUrl = await documentVaultService.getSignedUrl(urlArquivo);
      if (signedUrl) {
        window.open(signedUrl, '_blank');
      } else {
        toast({ title: 'Erro', description: 'Não foi possível gerar link para download.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Falha ao acessar documento.', variant: 'destructive' });
    }
  };

  // Collect unique tipos for filter
  const tipos = [...new Set(documents.map((d: DocumentVaultRecord) => d.tipo_documento))];

  return (
    <div className="bg-card rounded-xl shadow-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold font-display text-card-foreground">
          Documentos do Colaborador ({filtered.length})
        </h3>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {tipos.map(t => (
              <SelectItem key={t} value={t}>{tipoLabels[t] || t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando documentos...</p>
      ) : filtered.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">Assinatura</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(doc => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-card-foreground">{doc.nome_documento}</p>
                        {doc.hash_documento && (
                          <p className="text-xs text-muted-foreground font-mono truncate max-w-[180px]">
                            Hash: {doc.hash_documento.slice(0, 12)}...
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                      {tipoLabels[doc.tipo_documento] || doc.tipo_documento}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {doc.assinatura_valida ? (
                      <CheckCircle2 className="h-4 w-4 text-primary inline-block" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground inline-block" />
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleDownload(doc.url_arquivo, doc.nome_documento)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Abrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum documento encontrado.</p>
      )}
    </div>
  );
}
