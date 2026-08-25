import { useTextos } from '../textos';

const NUMEROS = ['01', '02', '03', '04'];

export default function SectionComoFunciona() {
  const { t } = useTextos('comofunciona');

  // A numeracao (01..04) fica no codigo — trocar o texto nao pode desalinhar
  // o "01" gigante do card com o passo que ele numera.
  const passos = NUMEROS.map((num, i) => ({
    num,
    title: t(`passo${i + 1}_titulo`),
    text: t(`passo${i + 1}_texto`),
  }));

  return (
    <section id="como-funciona" className="py-14 lg:py-28 bg-purple-50">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center mb-8 lg:mb-14">
          <span className="text-purple-800 text-xs font-semibold uppercase tracking-[0.08em] mb-3 block">
            {t('olho')}
          </span>
          <h2 className="font-display font-bold text-text-dark text-2xl sm:text-4xl lg:text-5xl mb-4">
            {t('titulo')}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {passos.map((p) => (
            <div key={p.num} className="relative">
              <div className="text-[64px] font-display font-bold text-purple-100 leading-none mb-4 select-none">
                {p.num}
              </div>
              <h3 className="font-display font-semibold text-text-dark text-lg mb-3 leading-snug">
                {p.title}
              </h3>
              <p className="text-text-gray text-sm leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
