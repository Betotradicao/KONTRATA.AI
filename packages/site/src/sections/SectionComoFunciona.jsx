const PASSOS = [
  {
    num: '01',
    title: 'Você cria a vaga em 1 minuto',
    text: 'Cargo, salário, jornada, requisitos. Formato direto, sem campos chatos. O sistema atualiza automaticamente.',
  },
  {
    num: '02',
    title: 'A vaga fica ativa pelos seus canais',
    text: 'Cola na bio do Instagram. Imprime QR Code na fachada. Manda no grupo de WhatsApp da cidade. O candidato clica ou escaneia o QR Code e vê as vagas em aberto.',
  },
  {
    num: '03',
    title: 'Candidatos se inscrevem pelo celular',
    text: 'Formulário simples, direto no celular. Sem criar conta, sem burocracia. O candidato preenche em 2 minutos e entra no seu banco.',
  },
  {
    num: '04',
    title: 'Seu RH só fala com quem vale',
    text: 'Os melhores candidatos sobem com tag verde. Os duvidosos com tag amarela. Os fora de perfil com tag vermelha. A decisão final é sempre sua — mas só com quem realmente importa.',
  },
];

export default function SectionComoFunciona() {
  return (
    <section id="como-funciona" className="py-14 lg:py-28 bg-purple-50">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center mb-8 lg:mb-14">
          <span className="text-purple-800 text-xs font-semibold uppercase tracking-[0.08em] mb-3 block">
            Como funciona?
          </span>
          <h2 className="font-display font-bold text-text-dark text-2xl sm:text-4xl lg:text-5xl mb-4">
            Do currículo ao contratado em 4 passos.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PASSOS.map((p) => (
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
