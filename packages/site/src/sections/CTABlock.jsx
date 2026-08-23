import { evento } from '../analytics';
import especialista from '../assets/especialista.png';

export default function CTABlock() {
  return (
    <section id="cta" className="py-12 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-hero-bg to-purple-800 p-6 sm:p-10 lg:p-16">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <span className="inline-block text-amber-400 text-xs font-semibold uppercase tracking-[0.08em] mb-3">
                Próximo passo
              </span>
              <h2 className="font-display font-bold text-white text-xl sm:text-3xl lg:text-5xl leading-[1.15] mb-4">
                Quer ver o Kontrataai funcionando na prática?
              </h2>
              <p className="text-purple-300 text-sm sm:text-lg leading-relaxed mb-6">
                30 minutos de demonstração. Mostramos o sistema na operação real e você decide
                se faz sentido. Sem cobrança, sem amarração.
              </p>
              <a
                href="#"
                onClick={() => evento('clique_demo', { origem: 'cta_final' })}
                className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-4 rounded-lg bg-amber-400 text-text-dark font-semibold text-base sm:text-lg hover:bg-amber-500 transition-all"
              >
                Agendar demonstração →
              </a>
            </div>

            <div className="hidden lg:flex justify-center">
              <img
                src={especialista}
                alt="Especialista pronta para atender"
                loading="lazy"
                className="w-72 h-72 object-cover rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
