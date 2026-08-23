import { Check, X } from 'lucide-react';

/**
 * ⚠️ NO SITE ORIGINAL ESTA LISTA ESTÁ VAZIA (`const r=[]`).
 * Ou seja: hoje aparece só o título e o texto — a tabela não tem nenhuma linha.
 * Deixei a estrutura pronta: basta preencher aqui que a tabela aparece sozinha,
 * no desktop como tabela e no celular como cards.
 *
 * Exemplo do formato:
 *   { criterio: 'Implantação', generico: 'De 30 a 90 dias', kontrata: '7 dias' },
 */
const CRITERIOS = [];

export default function SectionComparativo() {
  return (
    <section className="py-14 lg:py-28 bg-white">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center mb-8 lg:mb-14">
          <span className="text-purple-800 text-xs font-semibold uppercase tracking-[0.08em] mb-3 block">
            Por que Kontrataai
          </span>
          <h2 className="font-display font-bold text-text-dark text-2xl sm:text-4xl lg:text-5xl mb-4">
            <span className="sm:hidden">
              Não somos genéricos.
              <br />
              Somos do varejo alimentar.
            </span>
            <span className="hidden sm:inline">
              Não somos genéricos. Somos do varejo alimentar.
            </span>
          </h2>
          <p className="text-text-gray text-sm sm:text-lg max-w-2xl mx-auto">
            Existem dezenas de sistemas de RH no mercado. Quase todos foram feitos para
            empresas de qualquer setor — e adaptados na unha quando o cliente é um
            supermercado. O Kontrataai fez o caminho oposto: nasceu dentro de uma loja, e foi
            crescendo a partir de dores reais de operação. Faz diferença.
          </p>
        </div>

        {/* Sem linhas, não desenha cabeçalho de tabela vazio (fica com cara de bug). */}
        {CRITERIOS.length > 0 && (
          <>
            {/* Celular: um card por critério */}
            <div className="sm:hidden space-y-3">
              {CRITERIOS.map((c) => (
                <div
                  key={c.criterio}
                  className="bg-white rounded-xl p-4 shadow-[0_2px_12px_rgba(91,33,182,0.08)]"
                >
                  <p className="font-semibold text-text-dark text-sm mb-3">{c.criterio}</p>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-2 text-xs text-text-gray">
                      <X className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <span className="text-text-gray/60 font-medium">Genérico: </span>
                        {c.generico}
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-text-dark font-medium">
                      <Check className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
                      <span>
                        <span className="text-purple-800 font-semibold">Kontrataai: </span>
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
                    <th className="text-left px-4 py-3 font-semibold text-sm">Critério</th>
                    <th className="text-left px-4 py-3 font-semibold text-sm">RH Genérico</th>
                    <th className="text-left px-4 py-3 font-semibold text-sm text-amber-400">
                      Kontrataai
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CRITERIOS.map((c, i) => (
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
