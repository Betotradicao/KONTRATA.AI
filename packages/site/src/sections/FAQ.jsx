import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTextos } from '../textos';
import { VAGAS_FAQ } from '../conteudoPadrao';




export default function FAQ() {
  const { t, ehPadrao } = useTextos('faq');
  // Sanfona de item único: abrir um fecha o outro. Clicar no aberto fecha.
  const [aberto, setAberto] = useState(null);

  // Um par por vaga. Cada campo cai no padrao daquela posicao, e o par so
  // aparece se tiver pergunta E resposta — assim apagar a pergunta some com o
  // item inteiro, em vez de deixar um titulo vazio abrindo uma resposta orfa.
  const perguntas = Array.from({ length: VAGAS_FAQ }, (_, i) => ({
    q: t(`p${i + 1}`),
    a: t(`r${i + 1}`),
  })).filter((item) => item.q && item.a);

  return (
    <section id="faq" className="py-14 lg:py-28 bg-white">
      <div className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center mb-8 lg:mb-14">
          <h2 className="font-display font-bold text-text-dark text-2xl sm:text-4xl lg:text-5xl mb-4">
            {!ehPadrao('titulo') ? (
              t('titulo')
            ) : (
              <>
                <span className="sm:hidden">
                  As perguntas que
                  <br />
                  todo dono de
                  <br />
                  mercado faz.
                </span>
                <span className="hidden sm:inline">{t('titulo')}</span>
              </>
            )}
          </h2>
        </div>

        <div>
          {perguntas.map((item, i) => {
            const estaAberto = aberto === i;
            return (
              <div key={item.q} className="border-b border-border-light">
                <button
                  type="button"
                  onClick={() => setAberto(estaAberto ? null : i)}
                  aria-expanded={estaAberto}
                  className={`flex w-full items-center justify-between gap-4 py-5 text-left font-semibold text-base lg:text-lg transition-colors hover:text-purple-800 ${
                    estaAberto ? 'text-purple-800' : 'text-text-dark'
                  }`}
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                      estaAberto ? 'rotate-180 text-purple-800' : 'text-text-gray'
                    }`}
                  />
                </button>

                {/* grid 0fr -> 1fr anima a altura sem precisar medir em JS.
                    Mesma duracao do original (0.2s). */}
                <div
                  className="grid transition-all duration-200 ease-out"
                  style={{ gridTemplateRows: estaAberto ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <p className="pb-5 pt-0 text-sm text-text-gray leading-relaxed">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
