import { Check, X } from 'lucide-react';
import { useTextos } from '../textos';

/**
 * A tabela nasce VAZIA (era assim no site original) e é preenchida pelo painel,
 * em Configurar Site → Textos → Comparativo: uma linha por critério, no formato
 *
 *   Critério | RH Genérico | Kontrataai
 *
 * Sem nenhuma linha, a seção mostra só o título e o texto — cabeçalho de tabela
 * sem conteúdo fica com cara de bug.
 */
/** Converte "a | b | c" nas três colunas. Linha torta é ignorada, não quebra. */
function lerCriterios(linhas) {
  return linhas
    .map((linha) => linha.split('|').map((c) => c.trim()))
    .filter((c) => c.length >= 3 && c[0])
    .map(([criterio, generico, kontrata]) => ({ criterio, generico, kontrata }));
}

export default function SectionComparativo() {
  const { t, lista, ehPadrao } = useTextos('comparativo');
  const criterios = lerCriterios(lista('criterios'));

  return (
    <section id="comparativo" className="py-14 lg:py-28 bg-white">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center mb-8 lg:mb-14">
          <span className="text-purple-800 text-xs font-semibold uppercase tracking-[0.08em] mb-3 block">
            {t('olho')}
          </span>
          <h2 className="font-display font-bold text-text-dark text-2xl sm:text-4xl lg:text-5xl mb-4">
            {/* Mesma ideia da secao "De onde nasceu": a quebra a mao so vale
                enquanto o titulo nao foi editado. */}
            {!ehPadrao('titulo') ? (
              t('titulo')
            ) : (
              <>
                <span className="sm:hidden">
                  Não somos genéricos.
                  <br />
                  Somos do varejo alimentar.
                </span>
                <span className="hidden sm:inline">{t('titulo')}</span>
              </>
            )}
          </h2>
          <p className="text-text-gray text-sm sm:text-lg max-w-2xl mx-auto">
            {t(
              'texto',
              'Existem dezenas de sistemas de RH no mercado. Quase todos foram feitos para empresas de qualquer setor — e adaptados na unha quando o cliente é um supermercado. O Kontrataai fez o caminho oposto: nasceu dentro de uma loja, e foi crescendo a partir de dores reais de operação. Faz diferença.'
            )}
          </p>
        </div>

        {/* Sem linhas, não desenha cabeçalho de tabela vazio (fica com cara de bug). */}
        {criterios.length > 0 && (
          <>
            {/* Celular: um card por critério */}
            <div className="sm:hidden space-y-3">
              {criterios.map((c) => (
                <div
                  key={c.criterio}
                  className="bg-white rounded-xl p-4 shadow-[0_2px_12px_rgba(91,33,182,0.08)]"
                >
                  <p className="font-semibold text-text-dark text-sm mb-3">{c.criterio}</p>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-2 text-xs text-text-gray">
                      <X className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <span className="text-text-gray/60 font-medium">{t('coluna2')}: </span>
                        {c.generico}
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-text-dark font-medium">
                      <Check className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
                      <span>
                        <span className="text-purple-800 font-semibold">{t('coluna3')}: </span>
                        {c.kontrata}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden sm:block overflow-x-auto rounded-2xl shadow-[0_4px_20px_rgba(91,33,182,0.08)]">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr className="bg-purple-800 text-white">
                    <th className="text-left px-4 py-3 font-semibold text-sm">
                      {t('coluna1')}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-sm">
                      {t('coluna2')}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-sm text-amber-400">
                      {t('coluna3')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {criterios.map((c, i) => (
                    <tr key={c.criterio} className={i % 2 === 0 ? 'bg-white' : 'bg-purple-50'}>
                      <td className="px-4 py-3 text-sm font-semibold text-text-dark">
                        {c.criterio}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-gray">
                        <span className="flex items-start gap-2">
                          <X className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                          {c.generico}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-dark font-medium">
                        <span className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                          {c.kontrata}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
