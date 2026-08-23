import { evento } from '../analytics';
import dashboard from '../assets/dashboard.png';

// Faixa deslizante do hero. A lista e duplicada de proposito: o marquee anda
// ate -50% e reinicia, entao a segunda copia cobre a emenda e o giro fica
// continuo, sem "pulo".
const RECURSOS = [
  'Banco de currículos automático',
  'Escala de Trabalho',
  'Documentação digital',
  'White label completo',
  'Indicadores RH',
  'Multi-loja e multi-empresa',
  '100% LGPD',
  'Suporte via WhatsApp',
  'Implantação em 7 dias',
  'Sem fidelidade',
];

/** Brilho dourado correndo na palavra "supermercado". */
function Shimmer({ children }) {
  return (
    <span
      className="animate-shimmer inline bg-clip-text text-transparent"
      style={{
        backgroundImage:
          'linear-gradient(90deg, #FBBF24 0%, #FDE68A 40%, #F59E0B 60%, #FBBF24 100%)',
        backgroundSize: '200% auto',
      }}
    >
      {children}
    </span>
  );
}

function Marquee() {
  const itens = [...RECURSOS, ...RECURSOS];
  return (
    <div className="mt-6 w-full overflow-hidden -mx-5">
      <div className="flex gap-3 w-max animate-marquee">
        {itens.map((r, i) => (
          <span
            key={i}
            className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium
                       bg-white/10 border border-white/15 text-white/80"
          >
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-hero-bg pt-16">
      {/* Gradiente roxo que "respira" — 400% de tamanho pra ter pra onde andar */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none animate-meshMove"
        style={{
          backgroundImage:
            'linear-gradient(135deg, #2E1065 0%, #4C1D95 25%, #2E1065 50%, #3B0764 75%, #5B21B6 100%)',
          backgroundSize: '400% 400%',
        }}
      />

      {/* Container mais largo que o original (80rem) pra caber a imagem maior.
          ⚠️ O respiro vertical e PROPOSITALMENTE curto (py-8, nao py-16):
          o titulo de 60px e a imagem maior ja esticam o bloco sozinhos. Aumentar
          o padding aqui deixa a faixa roxa gigante — ja tentei e o usuario pediu
          pra voltar. Se mexer no tamanho da fonte, reequilibre por aqui. */}
      <div className="relative max-w-[88rem] mx-auto px-5 py-10 sm:px-6 lg:px-8 lg:py-8 w-full box-border">
        {/* O original usava 50/50. O usuario pediu a imagem maior, entao o print
            do sistema ganha mais espaco que o texto (aprox. 60%/40%). */}
        <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-12 items-center">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-white leading-snug mb-4 text-[2rem] sm:text-5xl lg:text-[3.75rem]">
              Acabe com o caos
              <br />
              do RH do seu
              <br />
              <Shimmer>supermercado</Shimmer>.
            </h1>

            <p className="text-white/90 text-base lg:text-lg font-medium mb-2 break-words">
              O Kontrataai foi pensado exclusivamente para supermercado.
            </p>
            <p className="text-purple-300 text-sm lg:text-base leading-relaxed mb-6 break-words">
              Os candidatos se cadastram pelo seu link e você tem o banco de currículos
              organizado o ano inteiro.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="#cta"
                onClick={() => evento('clique_demo', { origem: 'hero' })}
                className="block text-center px-7 py-3.5 rounded-lg bg-amber-400 text-text-dark font-semibold text-base hover:bg-amber-500 transition-colors"
              >
                Quero ver uma demonstração →
              </a>
              <a
                href="#pricing"
                onClick={() => evento('clique_planos', { origem: 'hero' })}
                className="block text-center px-7 py-3.5 rounded-lg border-2 border-white/30 text-white font-semibold text-base hover:bg-white/10 transition-colors"
              >
                Ver os planos
              </a>
            </div>

            <Marquee />
          </div>

          <div className="hidden lg:block">
            <img
              src={dashboard}
              alt="Dashboard da Kontrataai"
              className="rounded-2xl shadow-2xl w-full"
              loading="eager"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
