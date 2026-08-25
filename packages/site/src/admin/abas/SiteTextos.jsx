import { useState, useEffect } from 'react';
import { ChevronDown, ExternalLink, Info } from 'lucide-react';
import { api } from '../api';

/**
 * Edição dos textos de kontrataai.com.br, seção por seção.
 *
 * A lista abaixo é a ÚNICA coisa a mexer pra expor um texto novo: acrescente a
 * chave aqui e ela aparece na tela. Nada de migration por frase.
 *
 * Campo em branco = o site usa o texto que está no código. Ou seja, mexer aqui
 * só sobrescreve o que você quiser — o resto continua como está.
 */
const SECOES = [
  {
    id: 'hero',
    titulo: 'Topo do site (hero)',
    campos: [
      { k: 'titulo1', r: 'Título — 1ª linha', p: 'Acabe com o caos' },
      { k: 'titulo2', r: 'Título — 2ª linha', p: 'do RH do seu' },
      { k: 'destaque', r: 'Palavra em destaque (dourada)', p: 'supermercado' },
      { k: 'sub1', r: 'Frase de apoio', p: 'O Kontrataai foi pensado exclusivamente para supermercado.' },
      { k: 'sub2', r: 'Frase menor', area: true },
      { k: 'cta1', r: 'Botão principal', p: 'Quero ver uma demonstração →' },
      { k: 'cta2', r: 'Botão secundário', p: 'Ver os planos' },
      { k: 'recursos', r: 'Faixa deslizante (um por linha)', area: true, lista: true },
    ],
  },
  {
    id: 'numeros',
    titulo: 'Números (prova social)',
    campos: [
      { k: 'rotulo1', r: 'Rótulo do 1º número', p: 'currículos captados' },
      { k: 'rotulo2', r: 'Rótulo do 2º número', p: 'pessoas contratadas' },
      { k: 'rodape', r: 'Frase abaixo dos números', p: 'Números reais dos supermercados que usam o Kontrataai.' },
    ],
  },
  {
    id: 'dor',
    titulo: 'Dor — "Você reconhece?"',
    campos: [
      { k: 'olho', r: 'Olho (texto pequeno acima)', p: 'O que todo dono de supermercado já viveu' },
      { k: 'titulo', r: 'Título', p: 'Você reconhece alguma dessas situações?' },
      { k: 'situacoes', r: 'Situações (uma por linha)', area: true, lista: true },
      { k: 'fecho', r: 'Frase de fecho (itálico)', area: true },
    ],
  },
  {
    id: 'solucao',
    titulo: 'Solução',
    campos: [
      { k: 'olho', r: 'Olho', p: 'A solução' },
      { k: 'titulo', r: 'Título', p: 'Um RH inteiro, feito para a sua realidade.' },
      { k: 'sub', r: 'Subtítulo', area: true },
      { k: 'card1_titulo', r: 'Card 1 — título' },
      { k: 'card1_texto', r: 'Card 1 — texto', area: true },
      { k: 'card2_titulo', r: 'Card 2 — título' },
      { k: 'card2_texto', r: 'Card 2 — texto', area: true },
    ],
  },
  {
    id: 'comofunciona',
    titulo: 'Como funciona (4 passos)',
    campos: [
      { k: 'olho', r: 'Olho', p: 'Como funciona?' },
      { k: 'titulo', r: 'Título', p: 'Do currículo ao contratado em 4 passos.' },
      { k: 'passo1_titulo', r: 'Passo 1 — título' },
      { k: 'passo1_texto', r: 'Passo 1 — texto', area: true },
      { k: 'passo2_titulo', r: 'Passo 2 — título' },
      { k: 'passo2_texto', r: 'Passo 2 — texto', area: true },
      { k: 'passo3_titulo', r: 'Passo 3 — título' },
      { k: 'passo3_texto', r: 'Passo 3 — texto', area: true },
      { k: 'passo4_titulo', r: 'Passo 4 — título' },
      { k: 'passo4_texto', r: 'Passo 4 — texto', area: true },
    ],
  },
  {
    id: 'origem',
    titulo: 'De onde nasceu',
    campos: [
      { k: 'olho', r: 'Olho', p: 'De onde nasceu?' },
      { k: 'titulo', r: 'Título', area: true },
      { k: 'texto', r: 'Texto', area: true },
      { k: 'destaque', r: 'Caixa em destaque', area: true },
    ],
  },
  {
    id: 'cta',
    titulo: 'Chamada final',
    campos: [
      { k: 'olho', r: 'Olho', p: 'Próximo passo' },
      { k: 'titulo', r: 'Título', p: 'Quer ver o Kontrataai funcionando na prática?' },
      { k: 'texto', r: 'Texto', area: true },
      { k: 'botao', r: 'Botão', p: 'Agendar demonstração →' },
    ],
  },
  {
    id: 'rodape',
    titulo: 'Rodapé',
    campos: [
      { k: 'descricao', r: 'Descrição sob a marca', area: true },
      { k: 'copyright', r: 'Direitos reservados', p: '© 2026 Kontrataai. Todos os direitos reservados.' },
    ],
  },
];

export default function SiteTextos() {
  const [dados, setDados] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(null);
  const [aberta, setAberta] = useState('hero');

  useEffect(() => {
    (async () => {
      try { setDados(await api.get('/site-config')); }
      catch { setDados({}); } finally { setCarregando(false); }
    })();
  }, []);

  const valor = (secao, campo) => dados?.[secao]?.[campo] ?? '';

  const mudar = (secao, campo, v) =>
    setDados((d) => ({ ...d, [secao]: { ...(d[secao] || {}), [campo]: v } }));

  const salvar = async (secao) => {
    setSalvando(secao.id);
    try {
      await api.put(`/site-config/${secao.id}`, dados[secao.id] || {});
    } finally {
      setSalvando(null);
    }
  };

  if (carregando) return <p className="p-8 text-center text-text-gray text-sm">Carregando…</p>;

  const campoCls = 'w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-600';

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-purple-800 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-purple-900">
          <strong>Campo em branco usa o texto atual do site.</strong> Só o que você
          escrever aqui substitui — não precisa preencher tudo. As mudanças valem na
          hora, sem republicar.{' '}
          <a href="/" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold hover:underline">
            ver o site <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      </div>

      {SECOES.map((secao) => {
        const abertaAgora = aberta === secao.id;
        return (
          <div key={secao.id} className="bg-white rounded-xl border border-border-light overflow-hidden">
            <button
              onClick={() => setAberta(abertaAgora ? null : secao.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-purple-50/50 transition-colors"
            >
              <span className="font-display font-bold text-text-dark text-sm">{secao.titulo}</span>
              <ChevronDown className={`w-4 h-4 text-text-gray transition-transform ${abertaAgora ? 'rotate-180' : ''}`} />
            </button>

            {abertaAgora && (
              <div className="px-4 pb-4 space-y-3 border-t border-border-light pt-4">
                {secao.campos.map((c) => (
                  <div key={c.k}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{c.r}</label>
                    {c.area ? (
                      <textarea rows={c.lista ? 6 : 3} value={valor(secao.id, c.k)}
                        onChange={(e) => mudar(secao.id, c.k, e.target.value)}
                        placeholder={c.p || ''} className={campoCls} />
                    ) : (
                      <input value={valor(secao.id, c.k)}
                        onChange={(e) => mudar(secao.id, c.k, e.target.value)}
                        placeholder={c.p || ''} className={campoCls} />
                    )}
                    {c.lista && (
                      <p className="text-[11px] text-text-gray mt-1">Um item por linha.</p>
                    )}
                  </div>
                ))}

                <div className="pt-2">
                  <button onClick={() => salvar(secao)} disabled={salvando === secao.id}
                    className="px-6 py-2 rounded-lg bg-purple-800 text-white text-sm font-bold hover:bg-purple-600 disabled:opacity-60">
                    {salvando === secao.id ? 'Salvando…' : `Salvar ${secao.titulo}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
