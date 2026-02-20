/**
 * WorkflowTemplates — Pre-built workflow templates page.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Copy, Zap, Users, CreditCard, Globe, Shield, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: typeof Zap;
  color: string;
  triggerCount: number;
  actionCount: number;
  tags: string[];
}

const TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'onboard-tenant',
    name: 'Onboarding de Cliente',
    description: 'Cria usuário admin, envia email de boas-vindas e atribui plano free ao criar cliente',
    category: 'Lifecycle',
    icon: Users,
    color: 'hsl(200 70% 50%)',
    triggerCount: 1,
    actionCount: 3,
    tags: ['tenant', 'onboarding', 'email'],
  },
  {
    id: 'payment-failure-alert',
    name: 'Alerta de Falha de Pagamento',
    description: 'Envia notificação Slack e email ao admin quando pagamento falha',
    category: 'Billing',
    icon: CreditCard,
    color: 'hsl(0 70% 55%)',
    triggerCount: 1,
    actionCount: 2,
    tags: ['billing', 'slack', 'alert'],
  },
  {
    id: 'landing-published-webhook',
    name: 'Webhook de Landing Publicada',
    description: 'Dispara webhook para CRM externo quando landing page é publicada',
    category: 'Growth',
    icon: Globe,
    color: 'hsl(340 75% 55%)',
    triggerCount: 1,
    actionCount: 1,
    tags: ['landing', 'webhook', 'growth'],
  },
  {
    id: 'app-review-flow',
    name: 'Fluxo de Revisão de App',
    description: 'Notifica equipe de review quando app é submetido e atualiza status',
    category: 'Developer Portal',
    icon: Shield,
    color: 'hsl(260 55% 52%)',
    triggerCount: 1,
    actionCount: 2,
    tags: ['devportal', 'review', 'notification'],
  },
  {
    id: 'usage-overage-escalation',
    name: 'Escalação de Excedente de Uso',
    description: 'Verifica plano do tenant e escala para billing quando uso excede limites',
    category: 'Billing',
    icon: Bell,
    color: 'hsl(38 92% 50%)',
    triggerCount: 1,
    actionCount: 3,
    tags: ['usage', 'billing', 'condition'],
  },
  {
    id: 'api-deprecation-notice',
    name: 'Aviso de Depreciação de API',
    description: 'Envia email para todos os clientes da API quando versão é deprecada',
    category: 'API Management',
    icon: Zap,
    color: 'hsl(145 60% 42%)',
    triggerCount: 1,
    actionCount: 2,
    tags: ['api', 'versioning', 'email'],
  },
];

export function WorkflowTemplates() {
  const [search, setSearch] = useState('');

  const filtered = TEMPLATES.filter(t => {
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.includes(q));
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar templates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Badge variant="outline" className="text-xs">{filtered.length} templates</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(template => {
          const Icon = template.icon;
          return (
            <Card key={template.id} className="hover:border-primary/30 transition-colors group">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${template.color}20`, color: template.color }}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-semibold truncate">{template.name}</CardTitle>
                    <Badge variant="outline" className="text-[9px] h-4 px-1 mt-1">{template.category}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground mb-3">{template.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <span className="text-[10px] text-muted-foreground">{template.triggerCount} trigger</span>
                    <span className="text-[10px] text-muted-foreground">{template.actionCount} actions</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => toast.success(`Template "${template.name}" clonado para editor`)}
                  >
                    <Copy className="h-3 w-3" /> Usar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {template.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-[9px] h-4 px-1.5">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
