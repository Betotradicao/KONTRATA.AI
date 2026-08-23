import { Link2, Zap } from 'lucide-react';

const CARDS = [
  {
    Icon: Link2,
    title: 'Banco de currículos automático',
    text: 'Você cria o link da vaga uma vez. Divulga onde quiser — fachada, Instagram, grupo de WhatsApp da cidade. Quem se interessa preenche o formulário no celular. Seu banco de currículos cresce todo dia, sem ninguém digitando nada.',
  },
  {
    Icon: Zap,
    title: 'Simples de usar',
    text: 'Não exige integração com o sistema que você já tem. Não pede TI. Não tem servidor para configurar. Você usa pelo navegador, com a sua identidade visual. Implantação em 2 dias — sem dor de cabeça.',
  },
];

export default function SectionSolucao() {
  return (
    <section className="py-14 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center mb-8 lg:mb-14">
          <span className="text-purple-800 text-xs font-semibold uppercase tracking-[0.08em] mb-3 block">
            A solução
          </span>
          <h2 className="font-display font-bold text-text-dark text-2xl sm:text-4xl lg:text-5xl mb-4">
            Um RH inteiro, feito para a sua realidade.
          </h2>
          <p className="text-text-gray text-sm sm:text-lg max-w-2xl mx-auto">
            O Kontrataai nasceu dentro de um supermercado, com uma dor real.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {CARDS.map(({ Icon, title, text }) => (
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
