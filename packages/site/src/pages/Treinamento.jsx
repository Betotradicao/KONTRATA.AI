import { useState, useEffect } from 'react';
import { ArrowLeft, Lock, PlayCircle, X } from 'lucide-react';
import { pageview } from '../analytics';

/**
 * Área de treinamento dos clientes.
 *
 * Usuário e senha são conferidos NO SERVIDOR (/admin/api/publico/treinamento/login)
 * e cadastrados no painel interno, um por cliente.
 *
 * ⚠️ A versão anterior tinha uma senha única escrita no próprio JavaScript —
 * qualquer visitante lia vendo o fonte da página. Não voltar àquilo.
 */

const CHAVE_TOKEN = 'kontrata_treinamento_token';

/** Rede de segurança: se a API cair, a página não abre vazia na frente do cliente. */
const VIDEOS_RESERVA = [
  { id: 1, titulo: 'Módulo 01 – Vídeo 01', descricao: 'Visão geral da plataforma e primeiros passos.', youtube_id: 'RqKadnMnBDQ' },
  { id: 2, titulo: 'Módulo 02 – Vídeo 01', descricao: 'Como criar e publicar vagas para candidatos.', youtube_id: 'iKeGO4RVVA4' },
  { id: 3, titulo: 'Módulo 03 – Vídeo 01', descricao: 'Filtragem, avaliação e avanço de candidatos.', youtube_id: '86UpDtVDjDI' },
  { id: 4, titulo: 'Módulo 04 – Vídeo 01', descricao: 'Envio e gestão de documentos dos colaboradores.', youtube_id: 'MjdoNRZ3aKc' },
];

function CardVideo({ video, aoTocar }) {
  const capa = `https://img.youtube.com/vi/${video.youtube_id}/hqdefault.jpg`;
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-border-light hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div
        className="relative aspect-video bg-purple-100 flex items-center justify-center overflow-hidden cursor-pointer group"
        onClick={aoTocar}
      >
        <img src={capa} alt={video.titulo} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition-colors">
          <PlayCircle className="w-12 h-12 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-display font-semibold text-text-dark text-sm mb-1">{video.titulo}</h3>
        <p className="text-text-gray text-xs leading-relaxed">{video.descricao}</p>
        <button
          onClick={aoTocar}
          className="mt-3 text-xs font-semibold text-purple-800 hover:text-purple-600 transition-colors"
        >
          Assistir agora →
        </button>
      </div>
    </div>
  );
}

export default function Treinamento() {
  const [liberado, setLiberado] = useState(false);
  const [cliente, setCliente] = useState(null);
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [videos, setVideos] = useState([]);
  const [tocando, setTocando] = useState(null);

  useEffect(() => {
    pageview('/treinamento');
    const guardado = localStorage.getItem(CHAVE_TOKEN);
    if (guardado) {
      setLiberado(true);
      setCliente(localStorage.getItem('kontrata_treinamento_cliente'));
    }
  }, []);

  // Busca os vídeos publicados no painel; cai na lista reserva se a API falhar.
  useEffect(() => {
    if (!liberado) return;
    (async () => {
      try {
        const r = await fetch('/admin/api/publico/treinamentos');
        const dados = await r.json();
        setVideos(Array.isArray(dados) && dados.length ? dados : VIDEOS_RESERVA);
      } catch {
        setVideos(VIDEOS_RESERVA);
      }
    })();
  }, [liberado]);

  const entrar = async (e) => {
    e.preventDefault();
    setErro('');
    setEntrando(true);
    try {
      const r = await fetch('/admin/api/publico/treinamento/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, senha }),
      });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro || 'Não foi possível entrar');
      localStorage.setItem(CHAVE_TOKEN, dados.token);
      if (dados.cliente) localStorage.setItem('kontrata_treinamento_cliente', dados.cliente);
      setCliente(dados.cliente);
      setLiberado(true);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEntrando(false);
    }
  };

  const sair = () => {
    localStorage.removeItem(CHAVE_TOKEN);
    localStorage.removeItem('kontrata_treinamento_cliente');
    setLiberado(false);
    setUsuario('');
    setSenha('');
  };

  if (!liberado) {
    const campo =
      'w-full border rounded-lg px-4 py-2.5 text-sm mb-3 outline-none focus:ring-2 focus:ring-purple-600 border-border-light';
    return (
      <div className="min-h-screen bg-hero-bg flex flex-col items-center justify-center px-5">
        <form onSubmit={entrar} className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-purple-800" />
          </div>
          <h1 className="font-display font-bold text-text-dark text-xl mb-1">
            Área de Treinamentos
          </h1>
          <p className="text-text-gray text-sm mb-6">
            Esta área é exclusiva para clientes. Entre com seu usuário e senha.
          </p>

          <input
            type="text"
            placeholder="Usuário"
            value={usuario}
            onChange={(e) => { setUsuario(e.target.value); setErro(''); }}
            autoComplete="username"
            required
            className={campo}
          />
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => { setSenha(e.target.value); setErro(''); }}
            autoComplete="current-password"
            required
            className={erro ? campo.replace('border-border-light', 'border-red-400') : campo}
          />

          {erro && <p className="text-red-500 text-xs mb-3">{erro}</p>}

          <button
            type="submit"
            disabled={entrando}
            className="w-full py-3 rounded-lg bg-amber-400 text-text-dark font-semibold text-sm hover:bg-amber-500 transition-all disabled:opacity-60"
          >
            {entrando ? 'Entrando…' : 'Acessar treinamentos'}
          </button>

          <a href="/" className="block mt-4 text-xs text-text-gray hover:text-purple-800 transition-colors">
            ← Voltar ao site
          </a>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-purple-50 font-body">
      <div className="bg-hero-bg py-10 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <a href="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors">
              <ArrowLeft className="w-4 h-4" /> Voltar ao site
            </a>
            <button onClick={sair} className="text-white/60 hover:text-white text-xs transition-colors">
              Sair
            </button>
          </div>
          <h1 className="font-display font-bold text-white text-3xl sm:text-4xl mb-2">
            Central de Treinamentos
          </h1>
          <p className="text-purple-300 text-sm sm:text-base">
            {cliente ? `${cliente} — todos os módulos disponíveis para você.` : 'Todos os módulos disponíveis para você.'}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-10">
        {!videos.length ? (
          <p className="text-center text-text-gray text-sm py-10">Carregando…</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {videos.map((v) => (
              <CardVideo key={v.id} video={v} aoTocar={() => setTocando(v)} />
            ))}
          </div>
        )}
      </div>

      {tocando && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setTocando(null)}>
          <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setTocando(null)} aria-label="Fechar vídeo"
              className="absolute -top-10 right-0 text-white hover:text-amber-400 transition-colors">
              <X className="w-7 h-7" />
            </button>
            <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-2xl bg-black">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${tocando.youtube_id}?autoplay=1`}
                title={tocando.titulo}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <p className="mt-3 text-white font-semibold text-center">{tocando.titulo}</p>
          </div>
        </div>
      )}
    </div>
  );
}
