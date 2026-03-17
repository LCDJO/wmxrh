/**
 * AdSlot — Generic ad rendering component.
 * 
 * Usage: <AdSlot placement="dashboard_home" />
 *
 * Automatically:
 *  - Fetches matching ad via AdDeliveryService
 *  - Renders banner/widget/popup
 *  - Records impression on mount
 *  - Records click on interaction
 *  - Sanitizes HTML content via DOMPurify
 */
import { useState } from 'react';
import { useAdSlot } from '@/domains/ads/hooks/useAdSlot';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DOMPurify from 'dompurify';

interface AdSlotProps {
  placement: string;
  planName?: string;
  userRole?: string;
  className?: string;
  enabled?: boolean;
}

export function AdSlot({ placement, planName, userRole, className = '', enabled = true }: AdSlotProps) {
  const { ad, loading, handleClick } = useAdSlot({ placement, planName, userRole, enabled });
  const [dismissed, setDismissed] = useState(false);

  if (loading || !ad || dismissed) return null;

  // Modal/popup type
  if (ad.type === 'popup' || ad.type === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
        <div className="bg-card rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-hidden border border-border">
          <div className="flex justify-end p-2">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDismissed(true)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="px-6 pb-6">
            {ad.image_url && (
              <img src={ad.image_url} alt={ad.title} className="w-full h-48 object-cover rounded-lg mb-4" />
            )}
            <h3 className="text-lg font-semibold text-foreground mb-2">{ad.title}</h3>
            {ad.html_content && (
              <div
                className="text-sm text-muted-foreground mb-4 prose prose-sm"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ad.html_content) }}
              />
            )}
            {ad.cta_text && (
              <Button onClick={handleClick} className="w-full">
                {ad.cta_text}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Banner type (default)
  return (
    <div
      className={`relative group rounded-lg overflow-hidden border border-border/40 cursor-pointer hover:shadow-md transition-shadow ${className}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      {/* Dismiss button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-background/80"
        onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
      >
        <X className="h-3 w-3" />
      </Button>

      {ad.image_url ? (
        <img src={ad.image_url} alt={ad.title} className="w-full h-auto object-cover" />
      ) : ad.html_content ? (
        <div
          className="p-4"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ad.html_content) }}
        />
      ) : (
        <div className="p-4 bg-primary/5">
          <p className="text-sm font-medium text-foreground">{ad.title}</p>
          {ad.cta_text && (
            <span className="text-xs text-primary font-semibold mt-1 inline-block">{ad.cta_text} →</span>
          )}
        </div>
      )}

      {/* Ad label */}
      <span className="absolute bottom-1 left-1 text-[8px] text-muted-foreground/50 uppercase tracking-wider">
        anúncio
      </span>
    </div>
  );
}
