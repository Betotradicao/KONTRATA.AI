import { useState, useEffect } from 'react';
import { Check, Lock } from 'lucide-react';
import { evento } from '../analytics';

/**
 * Seção de planos. O conteúdo vem do PAINEL INTERNO
 * (kontrataai.com.br/admin → Planos), então mudar preço, recursos ou tirar do
 * "Em breve" NÃO exige deploy.
 *
 * A lista abaixo é rede de segurança: se a API estiver fora do ar, a página de
 * vendas não pode aparecer sem planos. Mantenha em sincronia com o que estiver
 * publicado.
 */
const PLANOS_RESERVA = [
  {
    nome: 'Recrutamento',
    descricao: 'Para acabar com o caos da contratação.',
    valor: 398,
    destaque: true,
    badge: 'MAIS ESCOLHIDO',
    em_breve: false,
    cta: 'Começar pelo Recrutamento',
    link_pagamento: 'https://www.asaas.com/c/s9y29kncpe5up79j',
    recursos: [
      'Página de vagas com a sua marca',
      'Banco de currículos automático',
      'Triagem automática de candidatos',
      'Currículo em formato de quiz',
      'Suporte direto via WhatsApp',
    ],
  },
  {
    nome: 'Operacional',
    descricao: 'Recrutamento + gestão do dia a dia da loja.',
    valor: 697,
    destaque: false,
    badge: null,
    em_breve: true,
    cta: 'Em breve',
    recursos: [
      'Tudo do plano Recrutamento, e mais:',
      'Cadastro Geral de Colaboradores',
      'Documentação digital',
      'Escala de Trabalho (6x1, 5x2, 12x36)',
      'Departamento Pessoal',
      'Multi-loja e multi-empresa',
    ],
  },
  {
    nome: 'RH Completo',
    descricao: 'Para mercados que querem profissionalizar 100% o RH.',
    valor: 1197,
    destaque: false,
    badge: null,
    em_breve: true,
    cta: 'Em breve',
    recursos: [
      'Tudo do plano Operacional, e mais:',
      'Indicadores RH (dashboard ao vivo)',
      'Saúde Ocupacional (ASOs e prazos)',
      'Ponto e Ausências',
      'Controle de Férias',
      'Análise de Absenteísmo',
      'Pesquisa de Clima',
      'Treinamentos',
      'Financeiro RH',
    ],
  },
];

/** 398 -> "398", 1197 -> "1.197", 398.5 -> "398,50" */
const preco = (v) => {
  const n = Number(v) || 0;
  return n % 1 === 0
    ? n.toLocaleString('pt-BR')
    : n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
};

export default function Pricing() {
  const [planos, setPlanos] = useState(PLANOS_RESERVA);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/admin/api/publico/planos');
        const dados = await r.json();
        if (Array.isArray(dados) && dados.length) setPlanos(dados);
      } catch {
        /* API fora do ar: fica com a lista de reserva já carregada */
      }
    })();
  }, []);

  return (
    <section id="pricing" className="py-14 lg:py-28 bg-purple-50">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center mb-4">
          <span className="text-purple-800 text-xs font-semibold uppercase tracking-[0.08em] mb-3 block">
            Planos
          </span>
          <h2 className="font-display font-bold text-text-dark text-2xl sm:text-4xl lg:text-5xl mb-4">
            <span className="sm:hidden">
              Comece pelo
              <br />
              recrutamento.
              <br />
              Cresça quando
              <br />
              fizer sentido.
            </span>
            <span className="hidden sm:inline">
              Comece pelo recrutamento. Cresça quando fizer sentido.
            </span>
          </h2>
          <p className="text-text-gray text-sm sm:text-lg max-w-2xl mx-auto">
            Você escolhe o tamanho da solução. Sem amarração de longo prazo, sem multa por
            sair. Todos os planos incluem implantação em 7 dias, white label completo e
            suporte direto via WhatsApp.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mt-10">
          {planos.map((p) => (
            <div
              key={p.nome}
              className={`relative rounded-2xl p-6 sm:p-8 transition-all duration-300 hover:-translate-y-1 ${
                p.em_breve ? 'opacity-75' : ''
              } ${
                p.destaque
                  ? 'bg-white border-2 border-purple-800 shadow-[0_8px_40px_rgba(91,33,182,0.18)]'
                  : 'bg-white shadow-[0_4px_20px_rgba(91,33,182,0.08)]'
              }`}
            >
              {p.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-amber-400 text-text-dark text-xs font-bold uppercase tracking-wider">
                  {p.badge}
                </span>
              )}
              {p.em_breve && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold">
                  <Lock className="w-3 h-3" />
                  Em breve
                </div>
              )}

              <h3 className="font-display font-bold text-text-dark text-2xl mb-1">{p.nome}</h3>
              <p className="text-text-gray text-sm mb-6">{p.descricao}</p>

              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-text-gray text-sm">R$</span>
                  <span className="font-display font-bold text-text-dark text-4xl">
                    {preco(p.valor)}
                  </span>
                  <span className="text-text-gray text-sm">/mês</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {(p.recursos || []).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-text-gray">
                    <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {p.em_breve || !p.link_pagamento ? (
                <span className="block text-center px-6 py-3 rounded-lg bg-gray-100 text-gray-400 font-semibold text-sm cursor-default">
                  {p.cta || 'Em breve'}
                </span>
              ) : (
                <a
                  href={p.link_pagamento}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => evento('clique_assinar', { plano: p.nome })}
                  className="block text-center px-6 py-3 rounded-lg bg-amber-400 text-text-dark font-semibold text-sm hover:bg-amber-500 transition-colors"
                >
                  {p.cta || 'Quero este plano'}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
