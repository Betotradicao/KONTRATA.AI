import { useState, useEffect, useRef, useCallback } from 'react';
import { ExternalLink, RotateCcw, Check } from 'lucide-react';
import { api } from '../api';
import { PADRAO, VAGAS_FAQ } from '../../conteudoPadrao';

/**
 * Configurar Site → Textos.
 *
 * Formulário à esquerda, o site de verdade à direita, mudando enquanto se
 * digita. A prévia é um <iframe> do próprio site em `?preview=1`, e o rascunho
 * vai por postMessage a cada tecla.
 *
 * Por que iframe e não renderizar as seções aqui dentro: o site tem cabeçalho
 * fixo, animação por rolagem e largura de tela cheia. Dentro de uma <div> do
 * painel nada disso se comporta igual — e prévia que mente é pior que prévia
 * nenhuma. O iframe é o site, com o mesmo CSS e o mesmo comportamento.
 *
 * Pra expor um texto novo: acrescente a chave em `conteudoPadrao.js` e cite-a
 * na lista `SECOES` abaixo. Sem migration — o banco guarda tudo num jsonb.
 */

const SECOES = [
  {
    id: 'topo',
    titulo: 'Menu do topo',
    campos: [
      { k: 'marca', r: 'Nome da marca' },
      { k: 'entrar', r: 'Link "Entrar"' },
      { k: 'treinamento', r: 'Botão "Treinamento"' },
      { k: 'demo', r: 'Botão amarelo' },
    ],
  },
  {
    id: 'hero',
    titulo: 'Topo do site',
    campos: [
      { k: 'titulo1', r: 'Título — 1ª linha' },
      { k: 'titulo2', r: 'Título — 2ª linha' },
      { k: 'destaque', r: 'Palavra em destaque (dourada)' },
      { k: 'sub1', r: 'Frase de apoio' },
      { k: 'sub2', r: 'Frase menor', area: true },
      { k: 'cta1', r: 'Botão principal' },
      { k: 'cta2', r: 'Botão secundário' },
      { k: 'recursos', r: 'Faixa deslizante', area: true, lista: true },
    ],
  },
  {
    id: 'dor',
    titulo: 'Você reconhece?',
    campos: [
      { k: 'olho', r: 'Olho (texto pequeno acima)' },
      { k: 'titulo', r: 'Título' },
      { k: 'situacoes', r: 'Situações', area: true, lista: true },
      { k: 'fecho', r: 'Frase de fecho (itálico)', area: true },
    ],
  },
  {
    id: 'solucao',
    titulo: 'Solução',
    campos: [
      { k: 'olho', r: 'Olho' },
      { k: 'titulo', r: 'Título' },
      { k: 'sub', r: 'Subtítulo', area: true },
      { k: 'card1_titulo', r: 'Card 1 — título' },
      { k: 'card1_texto', r: 'Card 1 — texto', area: true },
      { k: 'card2_titulo', r: 'Card 2 — título' },
      { k: 'card2_texto', r: 'Card 2 — texto', area: true },
    ],
  },
  {
    id: 'como-funciona',
    secao: 'comofunciona',
    titulo: 'Como funciona (4 passos)',
    campos: [
      { k: 'olho', r: 'Olho' },
      { k: 'titulo', r: 'Título' },
      ...Array.from({ length: 4 }, (_, i) => [
        { k: `passo${i + 1}_titulo`, r: `Passo ${i + 1} — título` },
        { k: `passo${i + 1}_texto`, r: `Passo ${i + 1} — texto`, area: true },
      ]).flat(),
    ],
  },
  {
    id: 'comparativo',
    titulo: 'Comparativo (tabela)',
    campos: [
      { k: 'olho', r: 'Olho' },
      { k: 'titulo', r: 'Título' },
      { k: 'texto', r: 'Texto', area: true },
      { k: 'coluna1', r: 'Cabeçalho da 1ª coluna' },
      { k: 'coluna2', r: 'Cabeçalho da 2ª coluna' },
      { k: 'coluna3', r: 'Cabeçalho da 3ª coluna' },
      {
        k: 'criterios',
        r: 'Linhas da tabela',
        area: true,
        lista: true,
        p: 'Implantação | De 30 a 90 dias | 7 dias',
        dica: 'Uma linha por critério, separando as 3 colunas com | — Ex.: Implantação | De 30 a 90 dias | 7 dias. Sem nenhuma linha, a tabela não aparece.',
      },
    ],
  },
  {
    id: 'origem',
    titulo: 'De onde nasceu',
    campos: [
      { k: 'olho', r: 'Olho' },
      { k: 'titulo', r: 'Título', area: true },
      { k: 'texto', r: 'Texto', area: true },
      { k: 'destaque', r: 'Caixa em destaque', area: true },
    ],
  },
  {
    id: 'numeros',
    titulo: 'Números (prova social)',
    campos: [
      { k: 'rotulo1', r: 'Rótulo do 1º número' },
      { k: 'rotulo2', r: 'Rótulo do 2º número' },
      { k: 'rodape', r: 'Frase abaixo dos números', area: true },
      { k: 'titulo_clientes', r: 'Título da faixa de logos' },
    ],
    dica: 'Os logos que aparecem ao lado dos números são os clientes marcados como "Mostrar o logo em kontrataai.com.br" no cadastro de cada um.',
  },
  {
    id: 'faq',
    titulo: 'Perguntas frequentes',
    dica: 'A pergunta só aparece no site com pergunta E resposta preenchidas. As últimas estão em branco pra você acrescentar.',
    campos: [
      { k: 'titulo', r: 'Título', area: true },
      ...Array.from({ length: VAGAS_FAQ }, (_, i) => [
        { k: `p${i + 1}`, r: `${i + 1}ª pergunta`, area: true },
        { k: `r${i + 1}`, r: `${i + 1}ª resposta`, area: true },
      ]).flat(),
    ],
  },
  {
    id: 'cta',
    titulo: 'Chamada final',
    campos: [
      { k: 'olho', r: 'Olho' },
      { k: 'titulo', r: 'Título' },
      { k: 'texto', r: 'Texto', area: true },
      { k: 'botao', r: 'Botão' },
    ],
  },
  {
    id: 'rodape',
    titulo: 'Rodapé',
    campos: [
      { k: 'descricao', r: 'Descrição sob a marca', area: true },
      { k: 'copyright', r: 'Direitos reservados' },
    ],
  },
];

/** A chave da seção no banco (quase sempre igual ao id da âncora no site). */
const chaveDe = (s) => s.secao || s.id;

/** Listas viram texto de uma linha por item pra caber num textarea. */
const paraTexto = (v) => (Array.isArray(v) ? v.join('\n') : v ?? '');

export default function SiteTextos() {
  // `salvo` = o que está no banco. `rascunho` = o que está na tela. Separados
  // de propósito: é a diferença entre os dois que diz se falta salvar.
  const [salvo, setSalvo] = useState({});
  const [rascunho, setRascunho] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(null);
  const [aberta, setAberta] = useState(SECOES[0].id);
  const iframe = useRef(null);
  const previaPronta = useRef(false);

  useEffect(() => {
    (async () => {
      let doBanco = {};
      try {
        doBanco = (await api.get('/site-config')) || {};
      } catch {
        /* sem config ainda: começa tudo com o texto padrão */
      }
      // Campo nasce com o texto que o site mostra HOJE — a pessoa edita o que
      // já está lá, em vez de adivinhar o que apareceria se deixasse em branco.
      const inicial = {};
      for (const secao of SECOES) {
        const c = chaveDe(secao);
        inicial[c] = {};
        for (const campo of secao.campos) {
          const guardado = doBanco[c]?.[campo.k];
          inicial[c][campo.k] =
            guardado !== undefined && guardado !== null
              ? paraTexto(guardado)
              : paraTexto(PADRAO[c]?.[campo.k]);
        }
      }
      setSalvo(inicial);
      setRascunho(inicial);
      setCarregando(false);
    })();
  }, []);

  const avisarPrevia = useCallback((dados, irPara) => {
    if (!previaPronta.current) return;
    iframe.current?.contentWindow?.postMessage(
      { tipo: 'kontrata:previa', dados, irPara },
      '*'
    );
  }, []);

  // O iframe avisa quando terminou de carregar. Sem isso, a primeira leva de
  // rascunho sairia antes de existir alguém escutando, e a prévia abriria com
  // o texto do banco em vez do que está na tela.
  useEffect(() => {
    const aoReceber = (e) => {
      if (e.data?.tipo === 'kontrata:previa' && e.data.pronto) {
        previaPronta.current = true;
        avisarPrevia(rascunho, aberta);
      }
    };
    window.addEventListener('message', aoReceber);
    return () => window.removeEventListener('message', aoReceber);
  }, [rascunho, aberta, avisarPrevia]);

  useEffect(() => {
    if (!carregando) avisarPrevia(rascunho);
  }, [rascunho, carregando, avisarPrevia]);

  const mudar = (secao, campo, v) =>
    setRascunho((r) => ({ ...r, [secao]: { ...(r[secao] || {}), [campo]: v } }));

  const abrir = (secao) => {
    const id = aberta === secao.id ? null : secao.id;
    setAberta(id);
    if (id) avisarPrevia(rascunho, secao.id); // rola a prévia até a seção
  };

  const restaurar = (secao) => {
    const c = chaveDe(secao);
    const original = {};
    for (const campo of secao.campos) original[campo.k] = paraTexto(PADRAO[c]?.[campo.k]);
    setRascunho((r) => ({ ...r, [c]: original }));
  };

  const salvar = async (secao) => {
    const c = chaveDe(secao);
    setSalvando(c);
    try {
      await api.put(`/site-config/${c}`, rascunho[c] || {});
      setSalvo((s) => ({ ...s, [c]: rascunho[c] }));
    } finally {
      setSalvando(null);
    }
  };

  if (carregando) {
    return <p className="p-8 text-center text-text-gray text-sm">Carregando…</p>;
  }

  const campoCls =
    'w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-600';

  return (
    <div className="grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-5 items-start">
      {/* ── Formulário ─────────────────────────────────────────────── */}
      <div className="space-y-3 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto lg:pr-1">
        {SECOES.map((secao) => {
          const c = chaveDe(secao);
          const abertaAgora = aberta === secao.id;
          const mexido = JSON.stringify(rascunho[c]) !== JSON.stringify(salvo[c]);

          return (
            <div
              key={secao.id}
              className={`bg-white rounded-xl border overflow-hidden ${
                mexido ? 'border-amber-400' : 'border-border-light'
              }`}
            >
              <button
                onClick={() => abrir(secao)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-purple-50/50 transition-colors"
              >
                <span className="font-display font-bold text-text-dark text-sm">
                  {secao.titulo}
                </span>
                {mexido && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0">
                    não salvo
                  </span>
                )}
              </button>

              {abertaAgora && (
                <div className="px-4 pb-4 space-y-3 border-t border-border-light pt-4">
                  {secao.dica && (
                    <p className="text-[11px] text-text-gray bg-purple-50 rounded-lg px-3 py-2">
                      {secao.dica}
                    </p>
                  )}

                  {secao.campos.map((campo) => (
                    <div key={campo.k}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        {campo.r}
                      </label>
                      {campo.area ? (
                        <textarea
                          rows={campo.lista ? 6 : 3}
                          value={rascunho[c]?.[campo.k] ?? ''}
                          onChange={(e) => mudar(c, campo.k, e.target.value)}
                          placeholder={campo.p || ''}
                          className={campoCls}
                        />
                      ) : (
                        <input
                          value={rascunho[c]?.[campo.k] ?? ''}
                          onChange={(e) => mudar(c, campo.k, e.target.value)}
                          placeholder={campo.p || ''}
                          className={campoCls}
                        />
                      )}
                      {(campo.dica || campo.lista) && (
                        <p className="text-[11px] text-text-gray mt-1">
                          {campo.dica || 'Um item por linha.'}
                        </p>
                      )}
                    </div>
                  ))}

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => salvar(secao)}
                      disabled={salvando === c || !mexido}
                      className="px-6 py-2 rounded-lg bg-purple-800 text-white text-sm font-bold hover:bg-purple-600 disabled:opacity-40"
                    >
                      {salvando === c ? 'Salvando…' : mexido ? 'Salvar' : 'Salvo'}
                    </button>
                    <button
                      onClick={() => restaurar(secao)}
                      title="Volta esta seção ao texto original"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-light text-text-gray text-xs font-semibold hover:bg-purple-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Texto original
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Prévia ─────────────────────────────────────────────────── */}
      <div className="hidden lg:block sticky top-4">
        <div className="rounded-xl border border-border-light bg-white overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border-light bg-purple-50/50">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-dark">
              <Check className="w-3.5 h-3.5 text-success" />
              Prévia ao vivo — muda enquanto você digita
            </span>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-purple-800 hover:underline"
            >
              abrir o site <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* O site é feito pra 1280px. Espremê-lo numa coluna estreita daria
              uma prévia que não é o site — então ele renderiza na largura de
              verdade e a gente reduz por transform. */}
          <div className="h-[calc(100vh-13rem)] overflow-hidden bg-white">
            <iframe
              ref={iframe}
              src="/?preview=1"
              title="Prévia do site"
              className="origin-top-left border-0"
              style={{
                width: 1280,
                height: 'calc((100vh - 13rem) / 0.62)',
                transform: 'scale(0.62)',
              }}
            />
          </div>
        </div>
        <p className="text-[11px] text-text-gray mt-2 px-1">
          A prévia mostra só o rascunho. O site no ar continua com o texto
          anterior até você clicar em <strong>Salvar</strong>.
        </p>
      </div>
    </div>
  );
}
