import { Award, Shield } from 'lucide-react';

const COLUNAS = {
  Produto: ['Funcionalidades', 'Pricing', 'Para quem é', 'Demo'],
  Soluções: ['Mercado de bairro', 'Rede regional', 'Atacarejo'],
  Empresa: ['Sobre', 'Contato', 'Blog'],
};

export default function Footer() {
  return (
    <footer className="bg-hero-bg text-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-10 lg:py-20">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-12">
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="font-display font-bold text-xl text-white">Kontrataai</span>
            </div>
            <p className="text-purple-400 text-sm leading-relaxed mb-5 max-w-xs">
              Recrutamento inteligente e gestão completa com a marca do seu supermercado.
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-purple-600/50 text-xs">
                <Shield className="w-3.5 h-3.5 text-success" />
                100% LGPD
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-purple-600/50 text-xs">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                Garantia 30 dias
              </div>
            </div>
          </div>

          {Object.entries(COLUNAS).map(([titulo, itens]) => (
            <div key={titulo}>
              <h4 className="font-semibold text-xs uppercase tracking-wider text-white/50 mb-4">
                {titulo}
              </h4>
              <ul className="space-y-3">
                {itens.map((i) => (
                  <li key={i}>
                    <a
                      href="#"
                      className="text-purple-400 text-sm hover:text-white transition-colors"
                    >
                      {i}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <hr className="border-purple-600/20 my-8" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-purple-400">
          <p>© 2026 Kontrataai. Todos os direitos reservados.</p>
          <div className="flex gap-5">
            <a href="#" className="hover:text-white transition-colors">
              Termos de Uso
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Privacidade
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
