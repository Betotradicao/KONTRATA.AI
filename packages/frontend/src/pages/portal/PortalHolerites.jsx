import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';
import PasswordRequirements from '../../components/PasswordRequirements';
import { isPasswordStrong } from '../../utils/passwordPolicy';
import { portalApi, portalLogado, portalLogout } from '../../utils/portalApi';
import { usePortalInstall } from '../../utils/portalPwa';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmtComp = (c) => { const [y, m] = String(c || '').split('-'); return m ? `${MESES[parseInt(m) - 1]} / ${y}` : c; };
const fmtData = (d) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

// Lista de holerites do colaborador logado: abre o PDF, "Ciente / Recebi" registra a ciência.
export default function PortalHolerites() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aceitando, setAceitando] = useState(null);
  const [msg, setMsg] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [ano, setAno] = useState('');
  const [mes, setMes] = useState('');
  const [showIos, setShowIos] = useState(false);
  const { podeInstalar, instalar } = usePortalInstall();

  useEffect(() => { if (!portalLogado()) navigate('/portal', { replace: true }); }, [navigate]);

  const carregar = async () => {
    setLoading(true);
    try {
      const [m, h] = await Promise.all([portalApi.get('/portal/me'), portalApi.get('/portal/holerites')]);
      setMe(m.data); setItens(h.data);
    } catch { /* interceptor cuida do 401 */ }
    finally { setLoading(false); }
  };
  useEffect(() => { carregar(); }, []);

  // PDF abre em aba nova via blob (precisa do token no header; não dá pra linkar direto)
  const abrirPdf = async (it) => {
    try {
      const r = await portalApi.get(`/portal/holerites/${it.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      if (it.status === 'pendente') setItens(prev => prev.map(x => x.id === it.id ? { ...x, status: 'visualizado' } : x));
    } catch { setMsg('Não foi possível abrir o PDF. Tente novamente.'); }
  };

  // Ciência = assinatura: pede código de 6 dígitos no WhatsApp (2º fator). Se não der pra
  // enviar (sem celular / WhatsApp da loja fora), o backend libera a confirmação simples.
  const [ciencia, setCiencia] = useState(null); // { it, para, simples, codigo, erro, aguarde }

  const darCiencia = async (it) => {
    setAceitando(it.id);
    try {
      const { data } = await portalApi.post(`/portal/holerites/${it.id}/ciencia/codigo`);
      if (data.ja_aceito) { marcarAceito(it); return; }
      setCiencia({ it, para: data.para, simples: !data.enviado, codigo: '', erro: '', aguarde: data.aguarde || 60 });
    } catch (err) { setMsg(err.response?.data?.error || 'Erro ao pedir o código'); }
    finally { setAceitando(null); }
  };

  const marcarAceito = (it) => {
    setItens(prev => prev.map(x => x.id === it.id ? { ...x, status: 'aceito', aceito_em: new Date().toISOString() } : x));
    setMsg('✅ Recebimento registrado. Obrigado!');
    setTimeout(() => setMsg(''), 4000);
  };

  const confirmarCiencia = async () => {
    const c = ciencia;
    if (!c.simples && c.codigo.length !== 6) { setCiencia({ ...c, erro: 'Digite os 6 números' }); return; }
    setCiencia({ ...c, enviando: true, erro: '' });
    try {
      await portalApi.post(`/portal/holerites/${c.it.id}/ciencia`, c.simples ? {} : { codigo: c.codigo });
      setCiencia(null);
      marcarAceito(c.it);
    } catch (err) { setCiencia({ ...c, enviando: false, erro: err.response?.data?.error || 'Erro ao registrar' }); }
  };

  const reenviarCodigo = async () => {
    const c = ciencia;
    try {
      const { data } = await portalApi.post(`/portal/holerites/${c.it.id}/ciencia/codigo`);
      setCiencia({ ...c, para: data.para, simples: !data.enviado, aguarde: data.aguarde || 60, erro: data.enviado ? '' : c.erro });
    } catch (err) { setCiencia({ ...c, erro: err.response?.data?.error || 'Erro ao reenviar' }); }
  };

  useEffect(() => {
    if (!ciencia || ciencia.simples || !ciencia.aguarde) return;
    const t = setTimeout(() => setCiencia(c => c && ({ ...c, aguarde: Math.max(0, (c.aguarde || 0) - 1) })), 1000);
    return () => clearTimeout(t);
  }, [ciencia]);

  const sair = () => { portalLogout(); navigate('/portal', { replace: true }); };

  const anos = useMemo(() => [...new Set(itens.map(i => String(i.competencia || '').slice(0, 4)).filter(Boolean))].sort().reverse(), [itens]);
  const filtrados = useMemo(() => itens.filter(i => {
    const [y, m] = String(i.competencia || '').split('-');
    return (!ano || y === ano) && (!mes || m === mes);
  }), [itens, ano, mes]);

  const clicarInstalar = async () => {
    const r = await instalar();
    if (r === 'ios') setShowIos(true);
  };

  const badge = (s) => ({
    pendente:    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">NOVO</span>,
    visualizado: <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">VISTO</span>,
    aceito:      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">CIENTE ✓</span>,
  }[s] || null);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F3EAFE' }}>
      <header className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#3D1B7E' }}>
        <div className="flex items-center gap-3 min-w-0">
          <Logo size="small" />
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{me?.nome || '…'}</p>
            <p className="text-white/60 text-[11px] truncate">{[me?.cargo, me?.empresa].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowSenha(true)} className="text-white/80 text-xs px-2 py-1 rounded hover:bg-white/10" title="Trocar senha">🔑</button>
          <button onClick={sair} className="text-white/80 text-xs px-2 py-1 rounded hover:bg-white/10">Sair</button>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-3">
        {podeInstalar && (
          <button onClick={clicarInstalar}
            className="w-full flex items-center gap-3 bg-white border-2 border-purple-300 rounded-xl p-3 text-left hover:bg-purple-50">
            <span className="text-2xl">📲</span>
            <span className="flex-1">
              <span className="block font-bold text-purple-900 text-sm">Instalar app no celular</span>
              <span className="block text-[11px] text-gray-500">Fica um ícone na tela inicial — abre direto, sem procurar o link</span>
            </span>
            <span className="text-purple-700 font-bold text-sm">Instalar</span>
          </button>
        )}

        <div className="flex items-end justify-between gap-2 flex-wrap">
          <h1 className="text-base font-bold text-purple-900">Meus holerites</h1>
          {itens.length > 0 && (
            <div className="flex gap-2">
              <select value={ano} onChange={e => setAno(e.target.value)} className="border border-purple-200 rounded-lg px-2 py-1.5 text-sm bg-white">
                <option value="">Todos os anos</option>
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={mes} onChange={e => setMes(e.target.value)} className="border border-purple-200 rounded-lg px-2 py-1.5 text-sm bg-white">
                <option value="">Todos os meses</option>
                {MESES.map((nome, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{nome}</option>)}
              </select>
            </div>
          )}
        </div>
        {msg && <div className="p-3 rounded-lg bg-white border border-purple-200 text-sm text-purple-900">{msg}</div>}

        {loading && <p className="text-center text-gray-500 py-10">Carregando…</p>}
        {!loading && itens.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center text-gray-500">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-sm">Nenhum holerite publicado ainda.</p>
          </div>
        )}

        {!loading && itens.length > 0 && filtrados.length === 0 && (
          <div className="bg-white rounded-xl p-6 text-center text-gray-500 text-sm">Nenhum holerite nesse período.
            <button onClick={() => { setAno(''); setMes(''); }} className="block mx-auto mt-2 text-purple-700 font-semibold">Limpar filtro</button>
          </div>
        )}

        {filtrados.map(it => (
          <div key={it.id} className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-gray-900">{fmtComp(it.competencia)}</p>
                <p className="text-xs text-gray-500">{it.tipo_nome || 'PAGAMENTO'}{it.enviado_em ? ` · enviado ${fmtData(it.enviado_em)}` : ''}</p>
              </div>
              {badge(it.status)}
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => abrirPdf(it)} className="flex-1 py-2.5 rounded-lg border border-purple-300 text-purple-800 font-semibold text-sm hover:bg-purple-50">
                📄 {it.status === 'aceito' ? 'PDF + comprovante' : 'Abrir PDF'}
              </button>
              {it.status !== 'aceito' ? (
                <button onClick={() => darCiencia(it)} disabled={aceitando === it.id}
                  className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-sm disabled:opacity-60">
                  {aceitando === it.id ? '…' : '✓ Ciente / Recebi'}
                </button>
              ) : (
                <div className="flex-1 py-2.5 text-center text-[11px] text-green-700 leading-tight">
                  Ciência registrada<br />{fmtData(it.aceito_em)}
                </div>
              )}
            </div>
          </div>
        ))}

        <p className="text-[10px] text-gray-400 text-center pt-4 leading-snug">
          Ao tocar em "Ciente / Recebi" o sistema registra data, hora, dispositivo e o código de verificação do documento, como comprovante de recebimento.
        </p>
      </main>

      {showSenha && <TrocarSenhaModal onClose={() => setShowSenha(false)} />}

      {ciencia && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-3" onClick={() => !ciencia.enviando && setCiencia(null)}>
          <div className="bg-white rounded-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900">Confirmar recebimento</h3>
            <p className="text-sm text-gray-600 mt-1">Holerite de <b>{fmtComp(ciencia.it.competencia)}</b> · {ciencia.it.tipo_nome || 'PAGAMENTO'}</p>

            {!ciencia.simples ? (
              <>
                <p className="text-sm text-gray-700 mt-4">Enviamos um código de 6 números para o seu WhatsApp <b>{ciencia.para}</b>.</p>
                <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={ciencia.codigo}
                  onChange={e => setCiencia({ ...ciencia, codigo: e.target.value.replace(/\D/g, '').slice(0, 6), erro: '' })}
                  onKeyDown={e => e.key === 'Enter' && confirmarCiencia()}
                  placeholder="000000"
                  className="w-full mt-3 text-center tracking-[0.5em] text-2xl font-bold py-3 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                <div className="text-center mt-2">
                  {ciencia.aguarde > 0
                    ? <span className="text-xs text-gray-400">Reenviar código em {ciencia.aguarde}s</span>
                    : <button onClick={reenviarCodigo} className="text-xs text-purple-700 font-semibold">Não chegou? Reenviar código</button>}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-700 mt-4">Ao confirmar, você declara que recebeu e conferiu este holerite.</p>
            )}

            {ciencia.erro && <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">{ciencia.erro}</div>}

            <div className="flex gap-2 mt-4">
              <button onClick={() => setCiencia(null)} disabled={ciencia.enviando} className="flex-1 py-2.5 rounded-lg bg-gray-100 text-sm font-semibold">Cancelar</button>
              <button onClick={confirmarCiencia} disabled={ciencia.enviando || (!ciencia.simples && ciencia.codigo.length !== 6)}
                className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-bold disabled:opacity-50">
                {ciencia.enviando ? '…' : '✓ Ciente / Recebi'}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-3 leading-snug">
              Será registrado data, hora, dispositivo{!ciencia.simples ? ', o código de confirmação' : ''} e a impressão digital (SHA-256) do documento, como comprovante de recebimento.
            </p>
          </div>
        </div>
      )}

      {showIos && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-3" onClick={() => setShowIos(false)}>
          <div className="bg-white rounded-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-3">📲 Instalar no iPhone</h3>
            <ol className="text-sm text-gray-700 space-y-3 list-decimal pl-5">
              <li>Abra esta página no <b>Safari</b>.</li>
              <li>Toque no botão <b>Compartilhar</b> <span className="inline-block border rounded px-1">⬆️</span> na barra de baixo.</li>
              <li>Role e toque em <b>"Adicionar à Tela de Início"</b>.</li>
              <li>Toque em <b>Adicionar</b>. Pronto — o ícone <b>Meu RH</b> aparece na tela.</li>
            </ol>
            <p className="text-[11px] text-gray-500 mt-3">Na primeira vez que abrir pelo ícone, entre com CPF e senha de novo.</p>
            <button onClick={() => setShowIos(false)} className="w-full mt-4 py-2.5 rounded-lg bg-purple-700 text-white font-bold text-sm">Entendi</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TrocarSenhaModal({ onClose }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirm, setConfirm] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const salvar = async (e) => {
    e.preventDefault(); setErro('');
    if (!isPasswordStrong(nova)) { setErro('A nova senha não atende aos requisitos'); return; }
    if (nova !== confirm) { setErro('As senhas não coincidem'); return; }
    setEnviando(true);
    try { await portalApi.post('/portal/senha', { senha_atual: atual, nova_senha: nova }); setOk(true); setTimeout(onClose, 1500); }
    catch (err) { setErro(err.response?.data?.error || 'Erro ao trocar senha'); }
    finally { setEnviando(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-3" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-3">Trocar senha</h3>
        {ok ? <p className="text-green-700 text-sm">✅ Senha alterada!</p> : (
          <form onSubmit={salvar} className="space-y-3" autoComplete="off">
            {erro && <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">{erro}</div>}
            <input type="password" placeholder="Senha atual" value={atual} onChange={e => setAtual(e.target.value)} autoComplete="current-password" className="w-full px-3 py-2.5 border rounded-lg" />
            <input type="password" placeholder="Nova senha" value={nova} onChange={e => setNova(e.target.value)} autoComplete="new-password" className="w-full px-3 py-2.5 border rounded-lg" />
            <PasswordRequirements password={nova} />
            <input type="password" placeholder="Repita a nova senha" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" className="w-full px-3 py-2.5 border rounded-lg" />
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-gray-100 text-sm font-semibold">Cancelar</button>
              <button type="submit" disabled={enviando} className="flex-1 py-2.5 rounded-lg bg-purple-700 text-white text-sm font-bold disabled:opacity-60">Salvar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
