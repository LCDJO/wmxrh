import { useMemo } from 'react';
import { ShieldCheck, AlertTriangle, AlertCircle, Info, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WebsiteBlock } from '@/domains/website-builder/types';
import { runComplianceCheck, type ComplianceIssue, type ComplianceOptions } from '@/domains/website-builder/marketing-compliance-engine';

const severityConfig = {
  error: { Icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20' },
  warning: { Icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10 border-warning/20' },
  info: { Icon: Info, color: 'text-primary', bg: 'bg-primary/5 border-primary/20' },
};

const categoryLabels: Record<string, string> = {
  fab: 'FAB',
  cta: 'CTA',
  content_policy: 'Conteúdo',
  tracking: 'Tracking',
  legal: 'Legal',
  seo: 'SEO',
  mobile_ux: 'Mobile UX',
};

interface Props {
  blocks: WebsiteBlock[];
  options?: ComplianceOptions;
  onHighlightBlock?: (blockId: string) => void;
}

export function CompliancePanel({ blocks, options, onHighlightBlock }: Props) {
  const report = useMemo(
    () => runComplianceCheck(blocks, options ?? {}),
    [blocks, options],
  );

  const scoreColor = report.score >= 80
    ? 'text-accent'
    : report.score >= 50
      ? 'text-warning'
      : 'text-destructive';

  const scoreBg = report.score >= 80
    ? 'bg-accent/10'
    : report.score >= 50
      ? 'bg-warning/10'
      : 'bg-destructive/10';

  return (
    <div className="w-72 shrink-0 rounded-xl border border-border/60 bg-card/60 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border/60 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold font-display text-foreground">Compliance</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl font-bold text-lg ${scoreBg} ${scoreColor}`}>
            {report.score}
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">
              {report.passed ? 'Aprovado' : 'Reprovado'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {report.issues.length} {report.issues.length === 1 ? 'item' : 'itens'}
            </p>
          </div>
        </div>
      </div>

      {/* Issues */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {report.issues.length === 0 ? (
            <div className="text-center py-6">
              <ShieldCheck className="h-8 w-8 text-accent mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Tudo em conformidade!</p>
            </div>
          ) : (
            report.issues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onHighlight={onHighlightBlock}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function IssueCard({ issue, onHighlight }: { issue: ComplianceIssue; onHighlight?: (id: string) => void }) {
  const { Icon, color, bg } = severityConfig[issue.severity];

  return (
    <div className={`rounded-lg border p-3 space-y-1.5 ${bg}`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${color}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {categoryLabels[issue.category] || issue.category}
            </span>
          </div>
          <p className="text-xs font-semibold text-foreground">{issue.title}</p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">{issue.description}</p>
          {issue.suggestion && (
            <p className="text-[10px] text-primary mt-1">💡 {issue.suggestion}</p>
          )}
        </div>
      </div>
      {issue.blockId && onHighlight && (
        <button
          onClick={() => onHighlight(issue.blockId!)}
          className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
        >
          Ver bloco <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
