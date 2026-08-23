export default function SectionOrigem() {
  return (
    <section className="py-14 lg:py-28 bg-purple-50">
      <div className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <span className="text-purple-800 text-xs font-semibold uppercase tracking-[0.08em] mb-3 block">
            De onde nasceu?
          </span>
          <h2 className="font-display font-bold text-text-dark text-2xl sm:text-4xl lg:text-5xl mb-4">
            <span className="sm:hidden">
              Não foi feito
              <br />
              por programador.
              <br />
              Foi feito por gente
              <br />
              que vive supermercado
              <br />
              todo dia.
            </span>
            <span className="hidden sm:inline">
              Não foi feito por programador. Foi feito por gente que vive supermercado todo
              dia.
            </span>
          </h2>
        </div>

        <div className="space-y-6">
          <p className="text-text-gray text-sm sm:text-lg leading-relaxed">
            O Kontrataai começou com uma conversa há 6 meses. Uma cliente nossa, dona de
            mercado em São José dos Campos, falou que o RH dela perdia horas todo dia abrindo
            currículo, ligando candidato, marcando entrevista que não acontecia. E nada
            andava.
          </p>

          <div className="bg-white rounded-2xl p-6 border-l-4 border-amber-400 shadow-[0_4px_20px_rgba(91,33,182,0.06)]">
            <p className="text-text-dark text-base leading-relaxed font-medium">
              Hoje, o sistema está rodando em produção e estamos validando agora com mais
              alguns mercados antes de abrir comercialmente em larga escala.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
