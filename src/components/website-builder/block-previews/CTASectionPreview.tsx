interface Props {
  content: Record<string, unknown>;
}

export function CTASectionPreview({ content }: Props) {
  return (
    <div className="rounded-lg bg-gradient-to-r from-primary to-primary/80 p-8 text-center space-y-3">
      <h3 className="text-xl font-bold text-primary-foreground">
        {(content.headline as string) || 'CTA'}
      </h3>
      <p className="text-sm text-primary-foreground/80">
        {(content.subheadline as string) || ''}
      </p>
      <button className="inline-flex items-center px-6 py-2.5 rounded-lg bg-background text-foreground text-sm font-medium">
        {(content.ctaText as string) || 'Ação'}
      </button>
    </div>
  );
}
