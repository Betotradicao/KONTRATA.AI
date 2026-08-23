import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const PERGUNTAS = [
  {
    q: 'Preciso integrar com meu sistema de PDV (Linx, Consinco, RP, Bluesoft, Avanço)?',
    a: 'Não. O Kontrataai é independente. Você usa pelo navegador, sem mexer em nada do que já roda hoje. Isso é proposital — implantação rápida e zero dor de cabeça com TI.',
  },
  {
    q: 'Como funciona o white label?',
    a: 'Você nos envia seu logo, suas cores e seu domínio. Em até 48 horas o sistema sobe com a sua identidade. Para o seu candidato, é a sua marca recrutando — não o Kontrataai. Esse é um dos maiores diferenciais do produto.',
  },
  {
    q: 'Quem cuida do suporte? Vou ficar perdido se algo quebrar?',
    a: 'WhatsApp Business com SLA de resposta em até 4 horas em horário comercial. Sem call center, sem ticket número 47823, sem URA. Você fala direto com quem entende do sistema.',
  },
  {
    q: 'E se eu quiser cancelar?',
    a: 'Cancela. Sem multa, sem letra miúda, sem fidelidade. Você continuou porque te servia, não porque estava preso. Esse é o teste que toda boa empresa de software deveria passar.',
  },
  {
    q: 'Quem está usando o Kontrataai hoje?',
    a: 'O sistema nasceu dentro do Supermercado Tradição. Estamos validando agora com mais alguns mercados selecionados antes de abrir comercialmente em larga escala. Por isso nossas vagas de implementação são limitadas.',
  },
];

export default function FAQ() {
  // Sanfona de item único: abrir um fecha o outro. Clicar no aberto fecha.
  const [aberto, setAberto] = useState(null);

  return (
    <section id="faq" className="py-14 lg:py-28 bg-white">
      <div className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center mb-8 lg:mb-14">
          <h2 className="font-display font-bold text-text-dark text-2xl sm:text-4xl lg:text-5xl mb-4">
            <span className="sm:hidden">
              As perguntas que
              <br />
              todo dono de
              <br />
              mercado faz.
            </span>
            <span className="hidden sm:inline">As perguntas que todo dono de mercado faz.</span>
          </h2>
        </div>

        <div>
          {PERGUNTAS.map((item, i) => {
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
