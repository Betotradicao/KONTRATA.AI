import { useState, useEffect } from 'react';
import api from '../services/api';

// Cache global pra evitar flash (carrega 1x, compartilha entre renders)
let _cachedBrand = { name: null, logo: null, loaded: false };

export default function Logo({ size = "medium", collapsed = false }) {
  const [brandName, setBrandName] = useState(_cachedBrand.name);
  const [logoUrl, setLogoUrl] = useState(_cachedBrand.logo);
  const [loaded, setLoaded] = useState(_cachedBrand.loaded);

  useEffect(() => {
    if (_cachedBrand.loaded) return; // Ja carregou, nao busca de novo
    api.get('/config/configurations')
      .then(res => {
        const configs = res.data?.data || res.data || {};
        const name = configs.client_brand_name || null;
        const logo = configs.client_logo_url || null;
        _cachedBrand = { name, logo, loaded: true };
        setBrandName(name);
        setLogoUrl(logo);
        setLoaded(true);
      })
      .catch(() => {
        _cachedBrand.loaded = true;
        setLoaded(true);
      });
  }, []);

  const sizeClasses = {
    small: { icon: "h-8 w-8", nameText: "text-xs" },
    medium: { icon: "h-40 w-40", nameText: "text-lg" },
    large: { icon: "h-28 w-auto max-w-[160px]", nameText: "text-sm" }
  };
  const classes = sizeClasses[size] || sizeClasses.medium;

  // Modo colapsado: so icone/iniciais
  if (collapsed) {
    if (!loaded) return <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse" />;
    if (logoUrl) return <img src={logoUrl} alt={brandName || 'Logo'} className="w-10 h-10 object-contain rounded-lg" />;
    const initials = brandName ? brandName.substring(0, 2).toUpperCase() : 'R';
    return (
      <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-sm">{initials}</span>
      </div>
    );
  }

  // Enquanto carrega, mostra placeholder do mesmo tamanho (sem flash)
  if (!loaded) {
    return (
      <div className="flex flex-col items-center space-y-2">
        <div className={`${classes.icon} bg-gray-200 rounded-lg animate-pulse`} />
      </div>
    );
  }

  // Se tem logo customizado
  if (logoUrl) {
    return (
      <div className="flex flex-col items-center space-y-1">
        <img src={logoUrl} alt={brandName || 'Logo'} className={`${classes.icon} object-contain`} />
        {brandName && (
          <div className="w-full bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 mt-1">
            <span className="text-xs font-bold text-orange-600 uppercase text-center block leading-tight" style={{letterSpacing: '0.05em'}}>
              {brandName}
            </span>
          </div>
        )}
        <div className="w-full text-center mt-2">
          <span className="text-xl font-extrabold tracking-tight" style={{ color: '#DAA520' }}>
            Kontrata.ai
          </span>
        </div>
      </div>
    );
  }

  // Se tem nome customizado mas sem logo
  if (brandName) {
    return (
      <div className="flex flex-col items-center space-y-1">
        <div className="h-16 w-16 bg-orange-500 rounded-xl flex items-center justify-center">
          <span className="text-white font-bold text-2xl">{brandName.substring(0, 2).toUpperCase()}</span>
        </div>
        <div className="w-full bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 mt-1">
          <span className="text-xs font-bold text-orange-600 uppercase text-center block leading-tight" style={{letterSpacing: '0.05em'}}>
            {brandName}
          </span>
        </div>
        <div className="w-full text-center mt-2">
          <span className="text-xl font-extrabold tracking-tight" style={{ color: '#DAA520' }}>
            Kontrata.ai
          </span>
        </div>
      </div>
    );
  }

  // Default: logo Kontrataai
  const isLarge = size === 'large';
  const isSmall = size === 'small';
  const textSize = isLarge ? 'text-6xl' : isSmall ? 'text-lg' : 'text-3xl';
  const heartSize = isLarge ? 'w-5 h-5' : isSmall ? 'w-2 h-2' : 'w-4 h-4';
  const heartOffset = isLarge ? '-translate-y-6' : isSmall ? '-translate-y-2' : '-translate-y-4';
  return (
    <div className="flex items-baseline" style={{ position: 'relative' }}>
      <span className={`${textSize} font-extrabold tracking-tight`} style={{ color: '#FFD60A', letterSpacing: '-0.02em' }}>
        Kontrata.a<span style={{ position: 'relative', display: 'inline-block' }}>
          ı
          <svg
            className="fill-current"
            style={{
              color: '#FFFFFF',
              position: 'absolute',
              left: '50%',
              top: isLarge ? '-0.35em' : isSmall ? '-0.4em' : '-0.35em',
              transform: 'translateX(-50%)',
              width: isLarge ? '0.45em' : isSmall ? '0.4em' : '0.42em',
              height: isLarge ? '0.45em' : isSmall ? '0.4em' : '0.42em',
            }}
            viewBox="0 0 24 24"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </span>
      </span>
    </div>
  );
}

// Exporta funcao pra forcar reload do cache (usado no Restaurar Logo)
Logo.clearCache = () => {
  _cachedBrand = { name: null, logo: null, loaded: false };
};
