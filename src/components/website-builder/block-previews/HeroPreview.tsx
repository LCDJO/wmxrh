interface Props {
  content: Record<string, unknown>;
}

export function HeroPreview({ content }: Props) {
  return (
    <div className="rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 p-8 text-center space-y-4">
      <h2 className="text-2xl font-bold font-display text-foreground">
        {(content.headline as string) || 'Headline'}
      </h2>
      <p className="text-muted-foreground text-sm max-w-lg mx-auto">
        {(content.subheadline as string) || 'Subtítulo'}
      </p>
      <button className="inline-flex items-center px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
        {(content.ctaText as string) || 'CTA'}
      </button>
    </div>
  );
}
