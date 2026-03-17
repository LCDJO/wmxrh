/**
 * SafeHtml — Renders HTML content sanitized with DOMPurify to prevent XSS.
 */
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span', 'hr', 'img', 'sub', 'sup',
];

const ALLOWED_ATTR = ['class', 'style', 'href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'colspan', 'rowspan'];

interface SafeHtmlProps {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

export function SafeHtml({ html, className, style }: SafeHtmlProps) {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });

  return (
    <div
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
