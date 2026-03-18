/**
 * TenantAppsIntegrations — Tenant-side "Apps & Integrações" page.
 * Install apps, view permissions (granted scopes), revoke access.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { getPlanAllowedSignatureProviders, SIGNATURE_PROVIDER_LABELS } from '@/domains/employee-agreement/signature-provider-governance';
import type { Tables } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Store, Download, ShieldCheck, Trash2, ExternalLink, FileSignature, IdCard } from 'lucide-react';
import { toast } from 'sonner';
...
      <Card>
        <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <FileSignature className="h-4 w-4" />
              Assinatura Digital
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              O plano atual libera: {signaturePlanProviders.length > 0
                ? signaturePlanProviders.map((provider) => SIGNATURE_PROVIDER_LABELS[provider]).join(', ')
                : 'nenhum provider específico configurado — fallback liberado'}.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/integrations/document-signature')}>
            Configurar assinatura
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <IdCard className="h-4 w-4" />
              Consulta de CPF para admissão
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure as credenciais do provedor para preencher nome e data de nascimento automaticamente ao informar o CPF.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/integrations/cpf')}>
            Configurar consulta CPF
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="installed">
        <TabsList>
          <TabsTrigger value="installed">Instalados ({installations.length})</TabsTrigger>
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="permissions">Permissões & Scopes</TabsTrigger>
        </TabsList>

        {/* ── Installed Apps ── */}
        <TabsContent value="installed">
          {loadingInstalled ? (
            <p className="text-sm text-muted-foreground p-4">Carregando...</p>
          ) : installations.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Store className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum app instalado. Explore o marketplace!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {installations.map((inst) => {
                const app = inst.developer_apps;
                return (
                  <Card key={inst.id}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          {app?.icon_url ? <img src={app.icon_url} alt="" className="h-8 w-8 rounded" /> : <Store className="h-5 w-5 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-foreground truncate">{app?.name || 'App'}</h3>
                            <Badge variant="outline" className="text-[10px]">v{app?.version || '?'}</Badge>
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">{inst.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{app?.description || '—'}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">Instalado em {new Date(inst.installed_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive shrink-0"
                          onClick={() => uninstallMutation.mutate(inst.id)}
                          disabled={uninstallMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Marketplace ── */}
        <TabsContent value="marketplace">
          {loadingMarket ? (
            <p className="text-sm text-muted-foreground p-4">Carregando...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {marketplace.map((app) => {
                const alreadyInstalled = installedAppIds.has(app.id);
                return (
                  <Card key={app.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          {app.icon_url ? <img src={app.icon_url} alt="" className="h-8 w-8 rounded" /> : <Store className="h-5 w-5 text-muted-foreground" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-foreground truncate">{app.name}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2">{app.description || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Download className="h-3 w-3" />{app.install_count}</span>
                          <span>★ {app.rating_avg?.toFixed(1) || '—'}</span>
                        </div>
                        {alreadyInstalled ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Instalado</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            disabled={installMutation.isPending}
                            onClick={() => installMutation.mutate(app.id)}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            {installMutation.isPending ? 'Instalando…' : 'Instalar'}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Permissions & Scopes ── */}
        <TabsContent value="permissions">
          <Card>
            <CardHeader><CardTitle className="text-base">Permissões Concedidas</CardTitle></CardHeader>
            <CardContent>
              {subscriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma subscrição de API ativa.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="pb-2 font-medium text-muted-foreground">App</th>
                        <th className="pb-2 font-medium text-muted-foreground">Plano</th>
                        <th className="pb-2 font-medium text-muted-foreground">Scopes Concedidos</th>
                        <th className="pb-2 font-medium text-muted-foreground">Status</th>
                        <th className="pb-2 font-medium text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {subscriptions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-muted/50">
                          <td className="py-2.5 font-medium text-foreground">{sub.developer_apps?.name || '—'}</td>
                          <td className="py-2.5"><Badge variant="outline">{sub.plan_tier}</Badge></td>
                          <td className="py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {(sub.granted_scopes || []).map((scope: string) => (
                                <Badge key={scope} variant="outline" className="text-[10px]">
                                  <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />{scope}
                                </Badge>
                              ))}
                              {(!sub.granted_scopes || sub.granted_scopes.length === 0) && (
                                <span className="text-xs text-muted-foreground">Nenhum scope</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5"><Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">{sub.status}</Badge></td>
                          <td className="py-2.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive text-xs"
                              disabled={revokeMutation.isPending || sub.status === 'revoked'}
                              onClick={() => handleRevoke(sub.id, sub.developer_apps?.name || 'App')}
                            >
                              {sub.status === 'revoked' ? 'Revogado' : 'Revogar'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
