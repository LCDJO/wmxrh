/**
 * GrowthWebsiteDashboard — Main /platform/website dashboard with widgets.
 */
import { Globe, Paintbrush, LayoutTemplate, GitBranch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { ConversionHeatmap } from '@/components/platform/growth/ConversionHeatmap';
import { FABPerformanceInsights } from '@/components/platform/growth/FABPerformanceInsights';
import { AIHeadlineSuggestions } from '@/components/platform/growth/AIHeadlineSuggestions';

const QUICK_LINKS = [
  { to: '/platform/website/ai-designer', label: 'AI Designer', description: 'Otimização de conversão com IA', icon: Paintbrush },
  { to: '/platform/website/templates', label: 'Templates', description: 'Engine de templates para LPs', icon: LayoutTemplate },
  { to: '/platform/website/versions', label: 'Versionamento', description: 'Controle de versões e publicação', icon: GitBranch },
];

export default function GrowthWebsiteDashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Globe className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Website Platform</h1>
        </div>
        <p className="text-sm text-muted-foreground">Dashboard de performance, conversão e conteúdo do website.</p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {QUICK_LINKS.map(link => (
          <Card
            key={link.to}
            className="cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => navigate(link.to)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <link.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{link.label}</p>
                <p className="text-xs text-muted-foreground">{link.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Widgets row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConversionHeatmap />
        <FABPerformanceInsights />
      </div>

      {/* AI Suggestions full width */}
      <AIHeadlineSuggestions />
    </div>
  );
}
