import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { api } from '../../utils/api';

/**
 * Cartaz pronto pra imprimir usando a arte oficial (cartaz-template.png) como background,
 * sobrepondo apenas o logo da empresa (no escudo do topo) e o QR Code (no placeholder).
 *
 * Aspect ratio do template: 1024x1536 (2:3)
 * Renderizado em 794x1191 pra caber em A4 retrato.
 */
const TEMPLATE_W = 794;
const TEMPLATE_H = 1191;

// Posicoes calibradas em % do tamanho do cartaz, baseado no template original.
// Logo no canto SUPERIOR DIREITO com moldura branca
const LOGO_POS  = { left: '92%', top: '4%', size: '11%' };
// QR cobre o placeholder INTEIRO (incluindo cantos chanfrados e texto "COLOQUE AQUI")
const QR_BOX    = { left: '74.7%', top: '62.5%', width: '34%', height: '21%' };

export default function CartazDenuncia({ publicUrl, empresaNome, onClose }) {
  const cartazRef = useRef(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [gerando, setGerando] = useState(false);

  // Puxa logo cadastrado em Configuracoes > Empresa (client_logo_url)
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/configurations/client_logo_url');
        const url = r.data?.value || r.data?.client_logo_url || r.data;
        if (url && typeof url === 'string' && url.trim()) setLogoUrl(url);
      } catch (e) { /* sem logo cadastrado */ }
    })();
  }, []);

  const baixarCartaz = async () => {
    if (!cartazRef.current) return;
    setGerando(true);
    try {
      const canvas = await html2canvas(cartazRef.current, {
        scale: 2.5,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `cartaz-canal-denuncia-${(empresaNome || 'empresa').toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      alert('Erro ao gerar cartaz: ' + e.message);
    } finally {
      setGerando(false);
    }
  };

  const imprimir = async () => {
    if (!cartazRef.current) return;
    setGerando(true);
    try {
      const canvas = await html2canvas(cartazRef.current, {
        scale: 2.5,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const win = window.open('', '_blank');
      win.document.write(`
        <html><head><title>Cartaz Canal de Denuncia</title>
        <style>
          @page { size: A4 portrait; margin: 0; }
          body { margin: 0; padding: 0; }
          img { width: 100%; height: 100vh; object-fit: contain; display: block; }
        </style>
        </head><body><img src="${dataUrl}" /></body></html>
      `);
      win.document.close();
      setTimeout(() => { win.print(); }, 600);
    } catch (e) {
      alert('Erro ao imprimir: ' + e.message);
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white p-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">🎨 Cartaz pra imprimir</h2>
            <p className="text-xs opacity-90">QR Code e logo sobrepostos na arte oficial</p>
          </div>
          <button onClick={onClose} className="text-3xl leading-none opacity-90 hover:opacity-100">×</button>
        </div>

        <div className="p-4 space-y-3 bg-gray-50">
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <span className="text-xs text-gray-500 mr-auto">
              {logoUrl ? '✅ Logo da empresa carregado automaticamente' : '⚠️ Sem logo cadastrado — configure em Configurações → Empresa'}
            </span>
            <button onClick={imprimir} disabled={gerando} className="bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold">
              {gerando ? '⏳' : '🖨️'} Imprimir
            </button>
            <button onClick={baixarCartaz} disabled={gerando} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold">
              {gerando ? '⏳ Gerando...' : '⬇️ Baixar PNG'}
            </button>
          </div>

          <div className="overflow-x-auto flex justify-center">
            <div
              ref={cartazRef}
              style={{
                width: `${TEMPLATE_W}px`,
                height: `${TEMPLATE_H}px`,
                position: 'relative',
                background: '#fff',
                boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
              }}
            >
              {/* Background = arte oficial */}
              <img
                src="/cartaz-template.png"
                alt="Cartaz"
                style={{ width: '100%', height: '100%', display: 'block', position: 'absolute', top: 0, left: 0 }}
                crossOrigin="anonymous"
              />

              {/* LOGO da empresa - canto superior direito com moldura branca */}
              {logoUrl && (
                <div
                  style={{
                    position: 'absolute',
                    left: LOGO_POS.left,
                    top: LOGO_POS.top,
                    width: LOGO_POS.size,
                    aspectRatio: '1 / 1',
                    transform: 'translate(-50%, 0)',
                    background: '#fff',
                    padding: '6px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                  }}
                >
                  <img
                    src={logoUrl}
                    alt="Logo"
                    crossOrigin="anonymous"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                    }}
                  />
                </div>
              )}

              {/* QR Code - cobre o placeholder inteiro (incluindo texto "COLOQUE AQUI") */}
              <div
                style={{
                  position: 'absolute',
                  left: QR_BOX.left,
                  top: QR_BOX.top,
                  width: QR_BOX.width,
                  height: QR_BOX.height,
                  transform: 'translate(-50%, 0)',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                }}
              >
                <QRCodeCanvas
                  value={publicUrl || ''}
                  size={280}
                  level="H"
                  includeMargin={false}
                  style={{ width: '85%', height: '85%' }}
                />
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center">
            💡 Logo puxado automaticamente do cadastro. "Baixar PNG" pra imprimir colorido em A4 ou "Imprimir" pra mandar direto.
          </p>
        </div>
      </div>
    </div>
  );
}
