import { useState, useEffect, useCallback } from 'react';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

const MESES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

const MIN_LINHAS = 8; // pra a tabela manter a "cara" do modelo mesmo com poucos aniversariantes

const rodapePadrao = 'PARABÉNS ANIVERSARIANTES!\nÉ UM PRIVILÉGIO PODER CELEBRAR A VIDA DE VOCÊS!!';
const mensagemPadrao = (empresa) =>
  `Nesses dias especiais celebramos mais um ano de suas vidas. Toda a equipe do ${empresa || 'nosso supermercado'} se une para expressar as mais sinceras gratidões pela sua dedicação e empenho. A presença de vocês em nosso time é um presente, e suas contribuições diárias são fundamentais para o sucesso e o crescimento de nossa empresa.`;

// tamanhos de fonte padrão (px)
const FONTE_PADRAO = { cabecalho: 13, mensagem: 11, rodape: 12 };

export default function AniversariantesMesTab() {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [loja, setLoja] = useState(''); // '' = todas as lojas
  const [lojas, setLojas] = useState([]);
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [cabecalho, setCabecalho] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [rodape, setRodape] = useState(rodapePadrao);
  const [fonte, setFonte] = useState(FONTE_PADRAO);
  const [salvando, setSalvando] = useState(false);

  // Carrega marca/logo + textos/fontes salvos + lojas (uma vez)
  useEffect(() => {
    (async () => {
      try {
        const [bn, lg, cab, msg, rod, fCab, fMsg, fRod, st] = await Promise.all([
          api.get('/configurations/client_brand_name').catch(() => null),
          api.get('/configurations/client_logo_url').catch(() => null),
          api.get('/configurations/rh_aniversariantes_cabecalho').catch(() => null),
          api.get('/configurations/rh_aniversariantes_mensagem').catch(() => null),
          api.get('/configurations/rh_aniversariantes_rodape').catch(() => null),
          api.get('/configurations/rh_aniversariantes_fonte_cabecalho').catch(() => null),
          api.get('/configurations/rh_aniversariantes_fonte_mensagem').catch(() => null),
          api.get('/configurations/rh_aniversariantes_fonte_rodape').catch(() => null),
          api.get('/rh/empresas/stores/list').catch(() => ({ data: [] })),
        ]);
        const marca = bn?.data?.value?.trim() || '';
        setBrandName(marca);
        if (lg?.data?.value?.trim()) setLogoUrl(lg.data.value.trim());
        setCabecalho(cab?.data?.value?.trim() ? cab.data.value : marca);
        setMensagem(msg?.data?.value?.trim() ? msg.data.value : mensagemPadrao(marca));
        if (rod?.data?.value?.trim()) setRodape(rod.data.value);
        setFonte({
          cabecalho: parseInt(fCab?.data?.value, 10) || FONTE_PADRAO.cabecalho,
          mensagem: parseInt(fMsg?.data?.value, 10) || FONTE_PADRAO.mensagem,
          rodape: parseInt(fRod?.data?.value, 10) || FONTE_PADRAO.rodape,
        });
        setLojas(Array.isArray(st?.data) ? st.data : []);
      } catch { /* usa defaults */ }
    })();
  }, []);

  const carregar = useCallback(async (m, codLoja) => {
    setCarregando(true);
    try {
      const qs = `mes=${m}` + (codLoja !== '' && codLoja != null ? `&loja=${codLoja}` : '');
      const { data } = await api.get(`/rh/aniversariantes?${qs}`);
      setLista(Array.isArray(data?.aniversariantes) ? data.aniversariantes : []);
    } catch {
      setLista([]);
      toast.error('Erro ao carregar aniversariantes');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(mes, loja); }, [mes, loja, carregar]);

  const salvarTextos = async () => {
    setSalvando(true);
    try {
      await Promise.all([
        api.put('/configurations/rh_aniversariantes_cabecalho', { value: cabecalho || ' ' }),
        api.put('/configurations/rh_aniversariantes_mensagem', { value: mensagem || ' ' }),
        api.put('/configurations/rh_aniversariantes_rodape', { value: rodape || ' ' }),
        api.put('/configurations/rh_aniversariantes_fonte_cabecalho', { value: String(fonte.cabecalho) }),
        api.put('/configurations/rh_aniversariantes_fonte_mensagem', { value: String(fonte.mensagem) }),
        api.put('/configurations/rh_aniversariantes_fonte_rodape', { value: String(fonte.rodape) }),
      ]);
      toast.success('Textos salvos!');
    } catch (e) {
      toast.error('Erro ao salvar: ' + (e?.response?.data?.error || e.message));
    } finally {
      setSalvando(false);
    }
  };

  const imprimir = () => window.print();
  const linhasVazias = Math.max(0, MIN_LINHAS - lista.length);
  const campoCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm';
  const setF = (k, v) => setFonte(p => ({ ...p, [k]: Math.min(40, Math.max(7, parseInt(v, 10) || FONTE_PADRAO[k])) }));

  // label + seletor de tamanho de fonte (px) na mesma linha
  const LabelComFonte = ({ texto, fkey }) => (
    <div className="flex items-end justify-between mb-1">
      <label className="text-xs font-semibold text-gray-500">{texto}</label>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-400">fonte</span>
        <input type="number" min={7} max={40} value={fonte[fkey]} onChange={(e) => setF(fkey, e.target.value)}
          className="w-14 px-2 py-1 border border-gray-300 rounded text-xs text-center" />
        <span className="text-[10px] text-gray-400">px</span>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* CSS de impressão: retrato (em pé) e imprime só o cartão */}
      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          body * { visibility: hidden !important; }
          #aniv-cartao, #aniv-cartao * { visibility: visible !important; }
          #aniv-cartao { position: absolute !important; left: 0; top: 0; width: 100% !important; min-height: 277mm !important; box-shadow: none !important; }
          .aniv-no-print { display: none !important; }
        }
      `}</style>

      <div className="aniv-no-print mb-5">
        <h2 className="text-lg font-bold text-gray-800 mb-1">🎂 Aniversariantes do Mês</h2>
        <p className="text-sm text-gray-600">Modelo pronto pra imprimir / colar no mural. Personalize os textos à esquerda — o cartão à direita atualiza na hora.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ============ PAINEL DE EDIÇÃO (não imprime) ============ */}
        <div className="aniv-no-print w-full lg:w-[380px] shrink-0 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Mês</label>
              <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className={campoCls}>
                {MESES.map((nome, i) => (
                  <option key={i} value={i + 1}>{nome.charAt(0) + nome.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Loja</label>
              <select value={loja} onChange={(e) => setLoja(e.target.value)} className={campoCls}>
                <option value="">Todas as lojas</option>
                {lojas.map((l) => (
                  <option key={l.cod_loja} value={l.cod_loja}>{l.apelido || l.nome_fantasia || l.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <LabelComFonte texto="Cabeçalho (canto superior)" fkey="cabecalho" />
            <input type="text" value={cabecalho} onChange={(e) => setCabecalho(e.target.value)} className={campoCls} placeholder="Ex: Grupo Tradição" />
          </div>

          <div>
            <LabelComFonte texto="Mensagem (parabéns)" fkey="mensagem" />
            <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={6} className={`${campoCls} leading-relaxed`} />
          </div>

          <div>
            <LabelComFonte texto="Rodapé (chamada final)" fkey="rodape" />
            <textarea value={rodape} onChange={(e) => setRodape(e.target.value)} rows={2} className={`${campoCls} font-semibold`} />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={salvarTextos} disabled={salvando}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold border border-gray-300 disabled:opacity-50">
              {salvando ? 'Salvando…' : '💾 Salvar textos'}
            </button>
            <button onClick={imprimir}
              className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold">
              🖨️ Imprimir / PDF
            </button>
          </div>
          <p className="text-xs text-gray-400">Ao imprimir, marque <strong>"Gráficos de segundo plano"</strong> pra sair com as cores.</p>
        </div>

        {/* ===================== CARTÃO (modelo, retrato) ===================== */}
        <div className="flex-1 flex justify-center">
          <div
            id="aniv-cartao"
            className="relative bg-white overflow-hidden flex flex-col"
            style={{
              width: 520, maxWidth: '100%', minHeight: 720,
              border: '3px solid #c084fc', borderRadius: 14, padding: '26px 24px 22px',
              WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
            }}
          >
            {/* cantos decorativos laranja */}
            <div style={{ position: 'absolute', top: -28, right: -28, width: 80, height: 80, background: '#fb923c', borderRadius: '50%' }} />
            <div style={{ position: 'absolute', bottom: -28, left: -28, width: 80, height: 80, background: '#fb923c', borderRadius: '50%' }} />

            {/* Cabeçalho (Jornal da Firma removido) */}
            <div className="relative flex items-end justify-between mb-4" style={{ borderBottom: '1px solid #d1d5db', paddingBottom: 6 }}>
              <span className="font-semibold text-gray-700" style={{ fontSize: fonte.cabecalho }}>{cabecalho || brandName || ' '}</span>
              <span>&nbsp;</span>
            </div>

            {/* Título */}
            <h3 className="relative text-center font-extrabold tracking-tight text-gray-800 mb-4" style={{ fontSize: 18 }}>
              🎁 ANIVERSARIANTES DO MÊS DE {MESES[mes - 1]} 🎁
            </h3>

            {/* Tabela */}
            <table className="relative w-full border-collapse mb-4" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-bold text-white px-2 py-1.5" style={{ background: '#f97316', border: '1px solid #fff', width: '62%' }}>COLABORADOR</th>
                  <th className="text-center text-[11px] font-bold text-white px-2 py-1.5" style={{ background: '#f97316', border: '1px solid #fff' }}>DATA DE ANIVERSÁRIO</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((a, i) => (
                  <tr key={i}>
                    <td className="text-[11px] font-semibold text-gray-800 px-2 py-1" style={{ background: '#fed7aa', border: '1px solid #fff' }}>{a.nome}</td>
                    <td className="text-[11px] text-center text-gray-800 px-2 py-1" style={{ background: '#fed7aa', border: '1px solid #fff' }}>{a.data_aniversario}</td>
                  </tr>
                ))}
                {Array.from({ length: linhasVazias }).map((_, i) => (
                  <tr key={`v-${i}`}>
                    <td className="px-2 py-1" style={{ background: '#fed7aa', border: '1px solid #fff', height: 22 }}>&nbsp;</td>
                    <td className="px-2 py-1" style={{ background: '#fed7aa', border: '1px solid #fff' }}>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {carregando && <p className="aniv-no-print text-center text-xs text-gray-400 -mt-2 mb-2">carregando…</p>}

            {/* Mensagem de parabéns */}
            <p className="relative text-center text-gray-700 leading-relaxed whitespace-pre-wrap mb-2" style={{ fontSize: fonte.mensagem, fontWeight: 500 }}>
              {mensagem}
            </p>

            {/* Espaço em branco pros amigos escreverem à mão (empurra rodapé+logo pra base) */}
            <div className="relative flex-1" style={{ minHeight: 110 }} />

            {/* Rodapé */}
            <p className="relative text-center font-bold text-gray-800 leading-snug whitespace-pre-wrap mb-3" style={{ fontSize: fonte.rodape }}>
              {rodape}
            </p>

            {/* Logo da empresa (Personalização → client_logo_url) */}
            <div className="relative flex flex-col items-center">
              {logoUrl
                ? <img src={logoUrl} alt={brandName || 'Logo'} style={{ height: 56, objectFit: 'contain' }} />
                : <span className="font-extrabold text-orange-600 text-lg">{brandName || 'Logo'}</span>}
            </div>
          </div>
        </div>
      </div>

      {!carregando && lista.length === 0 && (
        <p className="aniv-no-print text-center text-sm text-gray-500 mt-4">
          Nenhum colaborador ativo faz aniversário em {MESES[mes - 1].toLowerCase()}{loja ? ' nesta loja' : ''}.
        </p>
      )}
    </div>
  );
}
