import { useTextos } from '../textos';

// Titulo padrao quebrado a mao pro celular. Se o painel mandar um titulo
// proprio, nao da pra adivinhar onde quebrar — ai vale o mesmo texto nas duas
// larguras e o navegador quebra sozinho.
const TITULO_PADRAO =
  'Não foi feito por programador. Foi feito por gente que vive supermercado todo dia.';

export default function SectionOrigem() {
  const { t } = useTextos('origem');
  const titulo = t('titulo', '');

  return (
    <section className="py-14 lg:py-28 bg-purple-50">
      <div className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <span className="text-purple-800 text-xs font-semibold uppercase tracking-[0.08em] mb-3 block">
            {t('olho', 'De onde nasceu?')}
          </span>
          <h2 className="font-display font-bold text-text-dark text-2xl sm:text-4xl lg:text-5xl mb-4">
            {titulo ? (
              titulo
            ) : (
              <>
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
                <span className="hidden sm:inline">{TITULO_PADRAO}</span>
              </>
            )}
          </h2>
        </div>

        <div className="space-y-6">
          <p className="text-text-gray text-sm sm:text-lg leading-relaxed">
            {t(
              'texto',
              'O Kontrataai começou com uma conversa há 6 meses. Uma cliente nossa, dona de mercado em São José dos Campos, falou que o RH dela perdia horas todo dia abrindo currículo, ligando candidato, marcando entrevista que não acontecia. E nada andava.'
            )}
          </p>

          <div className="bg-white rounded-2xl p-6 border-l-4 border-amber-400 shadow-[0_4px_20px_rgba(91,33,182,0.06)]">
            <p className="text-text-dark text-base leading-relaxed font-medium">
              {t(
                'destaque',
                'Hoje, o sistema está rodando em produção e estamos validando agora com mais alguns mercados antes de abrir comercialmente em larga escala.'
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
