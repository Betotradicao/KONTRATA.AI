import { Link2, Zap } from 'lucide-react';
import { useTextos } from '../textos';

const ICONES = [Link2, Zap];

export default function SectionSolucao() {
  const { t } = useTextos('solucao');

  // O icone fica no codigo; o texto dos dois cards vem do painel.
  const cards = ICONES.map((Icon, i) => ({
    Icon,
    title: t(`card${i + 1}_titulo`),
    text: t(`card${i + 1}_texto`),
  }));

  return (
    <section id="solucao" className="py-14 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center mb-8 lg:mb-14">
          <span className="text-purple-800 text-xs font-semibold uppercase tracking-[0.08em] mb-3 block">
            {t('olho')}
          </span>
          <h2 className="font-display font-bold text-text-dark text-2xl sm:text-4xl lg:text-5xl mb-4">
            {t('titulo')}
          </h2>
          <p className="text-text-gray text-sm sm:text-lg max-w-2xl mx-auto">
            {t('sub')}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {cards.map(({ Icon, title, text }) => (
            <div
              key={title}
              className="bg-purple-50 rounded-2xl p-5 sm:p-8 flex flex-col gap-3 sm:gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-800 flex items-center justify-center flex-shrink-0">
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-display font-semibold text-text-dark text-base sm:text-xl">
                {title}
              </h3>
              <p className="text-text-gray text-sm leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
