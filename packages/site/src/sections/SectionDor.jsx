const SITUACOES = [
  'Vaga aberta há 30 dias e ninguém para começar segunda.',
  'Caixa de e-mail entupida de currículo que ninguém lê.',
  'Funcionário novo dura 60 dias e some.',
  'Encarregado virou RH na marra.',
];

export default function SectionDor() {
  return (
    <section className="py-14 lg:py-28 bg-purple-50">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center mb-8 lg:mb-14">
          <span className="text-purple-800 text-xs font-semibold uppercase tracking-[0.08em] mb-3 block">
            O que todo dono de supermercado já viveu
          </span>
          <h2 className="font-display font-bold text-text-dark text-2xl sm:text-4xl lg:text-5xl mb-4">
            Você reconhece alguma dessas situações?
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {SITUACOES.map((s) => (
            <div
              key={s}
              className="bg-white rounded-2xl p-6 shadow-[0_4px_20px_rgba(91,33,182,0.08)] h-full flex flex-col"
            >
              <h3 className="font-display font-semibold text-text-dark text-base leading-snug">
                {s}
              </h3>
            </div>
          ))}
        </div>

        <p className="text-center text-text-gray text-base mt-10 max-w-2xl mx-auto italic">
          A rotatividade no varejo alimentar está entre as maiores do Brasil. Não é só seu
          problema. Mas é seu prejuízo — todo mês.
        </p>
      </div>
    </section>
  );
}
