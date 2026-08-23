import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

// Menu igual ao original. "Por que Kontrataai" e "Como funciona" apontam pro
// mesmo ancora (#como-funciona) — era assim no site do Base44, mantido.
const LINKS = [
  { label: 'Por que Kontrataai', href: '#como-funciona' },
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Planos', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export default function Header() {
  const [aberto, setAberto] = useState(false);
  // Topo transparente sobre o hero roxo; ao rolar vira branco solido.
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    const onScroll = () => setRolou(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        rolou ? 'bg-white shadow-md' : 'bg-transparent'
      }`}
    >
      {/* Mesma largura do hero (88rem) pra logo e menu alinharem com o texto */}
      <div className="max-w-[88rem] mx-auto px-5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a
            href="/"
            className={`font-display font-bold text-xl ${rolou ? 'text-text-dark' : 'text-white'}`}
          >
            Kontrataai
          </a>

          <nav className="hidden lg:flex items-center gap-8">
            {LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className={`text-sm font-medium transition-colors ${
                  rolou ? 'text-text-dark hover:text-purple-800' : 'text-white/90 hover:text-white'
                }`}
              >
                {l.label}
              </a>
            ))}
            <a
              href="#"
              className={`text-sm font-medium ${rolou ? 'text-purple-800' : 'text-white/90 hover:text-white'}`}
            >
              Entrar
            </a>
            <a
              href="/treinamento"
              className={`inline-flex items-center justify-center px-5 py-2 rounded-lg border font-semibold text-sm transition-all ${
                rolou
                  ? 'border-purple-800 text-purple-800 hover:bg-purple-50'
                  : 'border-white/40 text-white hover:bg-white/10'
              }`}
            >
              Treinamento
            </a>
            <a
              href="#cta"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-amber-400 text-text-dark font-semibold text-sm hover:bg-amber-500 transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              Agendar demo
            </a>
          </nav>

          <button
            onClick={() => setAberto(!aberto)}
            aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
            className={`lg:hidden p-2 ${rolou ? 'text-text-dark' : 'text-white'}`}
          >
            {aberto ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {aberto && (
        <div className="lg:hidden bg-white border-t border-border-light shadow-lg">
          <div className="px-4 py-4 space-y-3">
            {LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setAberto(false)}
                className="block text-text-dark font-medium py-2 hover:text-purple-600"
              >
                {l.label}
              </a>
            ))}
            <hr className="border-border-light" />
            <a href="#" className="block text-purple-800 font-medium py-2">
              Entrar
            </a>
            <a
              href="/treinamento"
              onClick={() => setAberto(false)}
              className="block text-center px-6 py-3 rounded-lg border border-purple-800 text-purple-800 font-semibold hover:bg-purple-50 transition-colors"
            >
              Treinamento
            </a>
            <a
              href="#cta"
              onClick={() => setAberto(false)}
              className="block text-center px-6 py-3 rounded-lg bg-amber-400 text-text-dark font-semibold hover:bg-amber-500 transition-colors"
            >
              Agendar demo
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
