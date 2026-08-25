import { evento } from '../analytics';
import { useTextos } from '../textos';
import { useWhatsApp } from '../useWhatsApp';
import especialista from '../assets/especialista.png';

export default function CTABlock() {
  const { t } = useTextos('cta');
  const zap = useWhatsApp();

  return (
    <section id="cta" className="py-12 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-hero-bg to-purple-800 p-6 sm:p-10 lg:p-16">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <span className="inline-block text-amber-400 text-xs font-semibold uppercase tracking-[0.08em] mb-3">
                {t('olho')}
              </span>
              <h2 className="font-display font-bold text-white text-xl sm:text-3xl lg:text-5xl leading-[1.15] mb-4">
                {t('titulo')}
              </h2>
              <p className="text-purple-300 text-sm sm:text-lg leading-relaxed mb-6">
                {t(
                  'texto',
                  '30 minutos de demonstração. Mostramos o sistema na operação real e você decide se faz sentido. Sem cobrança, sem amarração.'
                )}
              </p>
              <a
                href={zap || '#'}
                {...(zap ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                onClick={() => evento('clique_demo', { origem: 'cta_final' })}
                className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-4 rounded-lg bg-amber-400 text-text-dark font-semibold text-base sm:text-lg hover:bg-amber-500 transition-all"
              >
                {t('botao')}
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
