/**
 * /platform/governance/policies — Policy Registry Management
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Shield, Globe, ShoppingBag, Code, Plus } from 'lucide-react';
import { getPlatformPolicyGovernanceEngine } from '@/domains/platform-policy-governance';
import type { PlatformPolicy, PolicyScope } from '@/domains/platform-policy-governance/types';

const scopeConfig: Record<PolicyScope, { label: string; icon: typeof Globe; color: string }> = {
  global: { label: 'Global (SaaS)', icon: Globe, color: 'bg-primary/10 text-primary' },
  marketplace: { label: 'Marketplace', icon: ShoppingBag, color: 'bg-accent/10 text-accent-foreground' },
  api: { label: 'API Usage', icon: Code, color: 'bg-muted text-muted-foreground' },
  billing: { label: 'Billing', icon: FileText, color: 'bg-destructive/10 text-destructive' },
  custom: { label: 'Custom', icon: Shield, color: 'bg-secondary text-secondary-foreground' },
};

export default function GovernancePolicies() {
  const [policies, setPolicies] = useState<PlatformPolicy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const engine = getPlatformPolicyGovernanceEngine();
    engine.listPolicies().then(setPolicies).finally(() => setLoading(false));
  }, []);

  const byScope = (scope: PolicyScope) => policies.filter(p => p.scope === scope);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Políticas da Plataforma</h1>
          <p className="text-sm text-muted-foreground">Gerencie termos, privacidade e políticas de uso por escopo.</p>
        </div>
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          Nova Política
        </Button>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todas ({policies.length})</TabsTrigger>
          <TabsTrigger value="global">Global ({byScope('global').length})</TabsTrigger>
          <TabsTrigger value="marketplace">Marketplace ({byScope('marketplace').length})</TabsTrigger>
          <TabsTrigger value="api">API ({byScope('api').length})</TabsTrigger>
        </TabsList>

        {['all', 'global', 'marketplace', 'api'].map(tab => (
          <TabsContent key={tab} value={tab}>
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="grid gap-4">
                {(tab === 'all' ? policies : byScope(tab as PolicyScope)).map(policy => {
                  const sc = scopeConfig[policy.scope] ?? scopeConfig.custom;
                  const ScopeIcon = sc.icon;
                  return (
                    <Card key={policy.id} className="border-border">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-medium text-foreground">{policy.name}</CardTitle>
                          <div className="flex gap-2">
                            <Badge variant="outline" className={sc.color}>
                              <ScopeIcon className="mr-1 h-3 w-3" />
                              {sc.label}
                            </Badge>
                            {policy.is_mandatory && <Badge variant="destructive">Obrigatória</Badge>}
                          </div>
                        </div>
                        <CardDescription>{policy.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Slug: {policy.slug}</span>
                        <span>Categoria: {policy.category}</span>
                        <span>Aplica-se a: {policy.applies_to}</span>
                        <span>Grace: {policy.grace_period_days}d</span>
                      </CardContent>
                    </Card>
                  );
                })}
                {loading && <p className="text-sm text-muted-foreground p-4">Carregando...</p>}
                {!loading && policies.length === 0 && (
                  <p className="text-sm text-muted-foreground p-4">Nenhuma política cadastrada.</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
