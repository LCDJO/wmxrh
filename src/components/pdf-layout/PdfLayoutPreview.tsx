/**
 * PdfLayoutPreview — Real-time A4 preview of the PDF layout configuration.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PdfLayoutConfig } from '@/pages/PdfLayoutSettings';

interface Props {
  config: Partial<PdfLayoutConfig>;
}

export function PdfLayoutPreview({ config }: Props) {
  const c = {
    companyName: config.company_name_override || 'Nome da Empresa',
    subtitle: config.header_subtitle || 'Documento Oficial',
    headerFont: config.header_font_family || 'Helvetica Neue, Arial, sans-serif',
    bodyFont: config.body_font_family || 'Georgia, Times New Roman, serif',
    footerFont: config.footer_font_family || 'Helvetica Neue, Arial, sans-serif',
    headerSize: config.header_font_size || 16,
    bodySize: config.body_font_size || 13,
    footerSize: config.footer_font_size || 9,
    lineHeight: config.body_line_height || 1.7,
    primary: config.primary_color || '#1a1a2e',
    text: config.text_color || '#222222',
    secondary: config.secondary_text_color || '#666666',
    borderColor: config.header_border_color || '#1a1a2e',
    marginTop: config.margin_top || 15,
    marginBottom: config.margin_bottom || 15,
    marginLeft: config.margin_left || 15,
    marginRight: config.margin_right || 15,
    sectionGap: config.section_gap || 3,
    showLogo: config.show_logo ?? true,
    showDate: config.show_date ?? true,
    showQr: config.show_qr_code ?? true,
    showValidator: config.show_validator_code ?? true,
    showPages: config.show_page_numbers ?? true,
    qrSize: config.qr_code_size || 56,
    footerText: config.footer_text || '',
    logoUrl: config.logo_url || '',
  };

  // Scale: A4 = 210x297mm. Preview width ~420px → scale factor
  const SCALE = 420 / 210;
  const px = (mm: number) => mm * SCALE;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preview em Tempo Real</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center">
        <div
          className="bg-white border border-border shadow-lg relative overflow-hidden"
          style={{
            width: px(210),
            height: px(297),
            fontFamily: c.bodyFont,
          }}
        >
          {/* Header */}
          <div
            style={{
              margin: `${px(c.marginTop)}px ${px(c.marginRight)}px 0 ${px(c.marginLeft)}px`,
              borderBottom: `${SCALE * 1.5}px solid ${c.borderColor}`,
              paddingBottom: px(2),
              fontFamily: c.headerFont,
            }}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                {c.showLogo && c.logoUrl && (
                  <img src={c.logoUrl} alt="Logo" style={{ height: px(8), width: 'auto' }} className="object-contain" />
                )}
                {c.showLogo && !c.logoUrl && (
                  <div
                    style={{ width: px(8), height: px(8), backgroundColor: c.primary, borderRadius: px(1) }}
                    className="flex items-center justify-center"
                  >
                    <span style={{ color: '#fff', fontSize: px(4), fontWeight: 700 }}>
                      {c.companyName.charAt(0)}
                    </span>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: px(c.headerSize / 4), fontWeight: 700, color: c.primary }}>
                    {c.companyName}
                  </div>
                  <div style={{ fontSize: px(2.5), color: c.secondary }}>{c.subtitle}</div>
                </div>
              </div>
              {c.showDate && (
                <div style={{ fontSize: px(2.5), color: c.secondary }}>
                  {new Date().toLocaleDateString('pt-BR')}
                </div>
              )}
            </div>
            <div
              style={{
                marginTop: px(2),
                fontSize: px(3.5),
                fontWeight: 600,
                color: c.text,
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: px(0.3),
              }}
            >
              TÍTULO DO DOCUMENTO
            </div>
          </div>

          {/* Body area */}
          <div
            style={{
              margin: `${px(c.sectionGap)}px ${px(c.marginRight)}px`,
              marginLeft: px(c.marginLeft),
              fontFamily: c.bodyFont,
              fontSize: px(c.bodySize / 4),
              lineHeight: c.lineHeight,
              color: c.text,
            }}
          >
            <p style={{ marginBottom: px(2) }}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt
              ut labore et dolore magna aliqua. Ut enim ad minim veniam.
            </p>
            <p style={{ marginBottom: px(2) }}>
              Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat
              nulla pariatur. Excepteur sint occaecat cupidatat non proident.
            </p>
            <p>
              Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque
              laudantium, totam rem aperiam.
            </p>
          </div>

          {/* Footer */}
          <div
            style={{
              position: 'absolute',
              bottom: px(c.marginBottom),
              left: px(c.marginLeft),
              right: px(c.marginRight),
              borderTop: `${SCALE * 0.5}px solid #ddd`,
              paddingTop: px(2),
              fontFamily: c.footerFont,
            }}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center" style={{ gap: px(2) }}>
                {c.showQr && (
                  <div
                    style={{
                      width: px(c.qrSize / 4),
                      height: px(c.qrSize / 4),
                      border: `1px solid #eee`,
                      borderRadius: px(0.5),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#f9f9f9',
                    }}
                  >
                    <span style={{ fontSize: px(1.5), color: '#999' }}>QR</span>
                  </div>
                )}
                {c.showValidator && (
                  <div>
                    <div style={{ fontSize: px(1.8), color: '#999', textTransform: 'uppercase', letterSpacing: px(0.15) }}>
                      Código Validador
                    </div>
                    <div style={{ fontSize: px(2.5), fontWeight: 600, color: c.text, fontFamily: 'monospace', letterSpacing: px(0.2) }}>
                      DOC-ABC123-XYZ
                    </div>
                    {c.footerText && (
                      <div style={{ fontSize: px(1.5), color: '#aaa', marginTop: px(0.5) }}>
                        {c.footerText}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {c.showPages && (
                <div style={{ fontSize: px(c.footerSize / 4), color: '#999' }}>
                  Página 1 de 1
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
