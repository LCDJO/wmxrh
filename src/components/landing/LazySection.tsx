/**
 * LazySection — IntersectionObserver-based lazy loading wrapper for landing page sections.
 * Renders a lightweight placeholder until the section scrolls into view.
 */
import { useRef, useState, useEffect, type ReactNode } from 'react';

interface LazySectionProps {
  children: ReactNode;
  /** Extra margin around the viewport trigger (default "200px") */
  rootMargin?: string;
  /** Minimum height of the placeholder skeleton */
  minHeight?: string;
  /** Optional className for the wrapper */
  className?: string;
  /** If true, skip lazy loading and render immediately (e.g. hero) */
  eager?: boolean;
}

export function LazySection({
  children,
  rootMargin = '200px',
  minHeight = '200px',
  className,
  eager = false,
}: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    if (eager || visible) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, visible, rootMargin]);

  if (visible) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{ minHeight }}
      aria-hidden="true"
    />
  );
}
