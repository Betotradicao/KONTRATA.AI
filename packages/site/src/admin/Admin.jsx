import { useState, useEffect } from 'react';
import {
  Building2, Target, DollarSign, GraduationCap, Plug, LogOut, Users, Menu, Tags,
} from 'lucide-react';
import { api, pegarToken, limparToken } from './api';
import Login from './Login';
import TrocarSenha from './TrocarSenha';
import Clientes from './abas/Clientes';
import Financeiro from './abas/Financeiro';
import Treinamentos from './abas/Treinamentos';
import AcessosTreinamento from './abas/AcessosTreinamento';
import Usuarios from './abas/Usuarios';
import Integracoes from './abas/Integracoes';
import Planos from './abas/Planos';

const MENU = [
  { id: 'ativos',       label: 'Clientes Ativos',      Icon: Building2 },
  { id: 'prospeccao',   label: 'Clientes Prospecção',  Icon: Target },
  { id: 'financeiro',   label: 'Financeiro',           Icon: DollarSign },
  { id: 'treinamentos', label: 'Treinamentos',         Icon: GraduationCap },
  { id: 'integracoes',  label: 'Integrações',          Icon: Plug },
  { id: 'planos',       label: 'Planos',               Icon: Tags },
];

// Só o master enxerga. Fica no fim, separado do menu do dia a dia.
const ITEM_MASTER = { id: 'usuarios', label: 'Usuários', Icon: Users };

const dinheiro = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Admin() {
  const [carregando, setCarregando] = useState(true);
  const [usuario, setUsuario] = useState(null);
  const [precisaTrocar, setPrecisaTrocar] = useState(false);
  const [secao, setSecao] = useState('ativos');
  const [resumo, setResumo] = useState(null);
  const [menuAberto, setMenuAberto] = useState(false); // só no celular

  useEffect(() => {
    (async () => {
      if (!pegarToken()) return setCarregando(false);
      try {
        const eu = await api.get('/eu');
        setUsuario(eu);
        setPrecisaTrocar(eu.precisa_trocar_senha);
      } catch {
        limparToken();
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const carregarResumo = async () => {
    try { setResumo(await api.get('/resumo')); } catch { /* topo é enfeite, não trava a tela */ }
  };

  useEffect(() => {
    if (usuario && !precisaTrocar) carregarResumo();
  }, [usuario, precisaTrocar, secao]);

  const sair = () => { limparToken(); setUsuario(null); };

  if (carregando) {
    return (
      <div className="min-h-screen bg-hero-bg flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!usuario) {
    return (
      <Login
        aoEntrar={(r) => { setUsuario(r.usuario); setPrecisaTrocar(r.precisaTrocarSenha); }}
      />
    );
  }

  if (precisaTrocar) return <TrocarSenha aoTrocar={() => setPrecisaTrocar(false)} />;

  const itens = [...MENU, ...(usuario.master ? [ITEM_MASTER] : [])];
  const atual = itens.find((i) => i.id === secao);

  const irPara = (id) => { setSecao(id); setMenuAberto(false); };

  return (
    <div className="min-h-screen bg-purple-50 font-body">
      {/* ── Menu lateral ────────────────────────────────────────────────
          No desktop fica fixo. No celular vira gaveta, senão comeria
          metade da tela numa largura de 360px. */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-hero-bg text-white flex flex-col
                    transition-transform duration-200 lg:translate-x-0
                    ${menuAberto ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-5 py-5 border-b border-white/10">
          <a href="/" className="font-display font-bold text-xl hover:text-amber-400 transition-colors">
            Kontrataai
          </a>
          <p className="text-[10px] uppercase tracking-wider text-purple-300 mt-0.5">
            Painel Interno
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {MENU.map(({ id, label, Icon }) => (
            <ItemMenu key={id} ativo={secao === id} onClick={() => irPara(id)} Icon={Icon} label={label} />
          ))}

          {usuario.master && (
            <>
              <div className="mx-5 my-3 border-t border-white/10" />
              <p className="px-5 pb-1 text-[10px] uppercase tracking-wider text-purple-300/70">
                Administração
              </p>
              <ItemMenu
                ativo={secao === 'usuarios'}
                onClick={() => irPara('usuarios')}
                Icon={Users}
                label="Usuários"
              />
            </>
          )}
        </nav>

        <div className="px-5 py-4 border-t border-white/10">
          <p className="text-sm font-semibold">{usuario.nome}</p>
          <p className="text-xs text-purple-300 mb-3">
            {usuario.usuario}
            {usuario.master && <span className="ml-1.5 text-amber-400">· master</span>}
          </p>
          <button
            onClick={sair}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/30 hover:bg-white/10 transition-colors text-xs font-semibold w-full justify-center"
          >
            <LogOut className="w-3.5 h-3.5" /> Sair
          </button>
        </div>
      </aside>

      {/* Fundo escuro atrás da gaveta no celular */}
      {menuAberto && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMenuAberto(false)} />
      )}

      {/* ── Conteúdo ─────────────────────────────────────────────────── */}
      <div className="lg:pl-64">
        <header className="bg-white border-b border-border-light sticky top-0 z-20">
          <div className="px-5 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
            <button
              onClick={() => setMenuAberto(true)}
              aria-label="Abrir menu"
              className="lg:hidden p-2 -ml-2 text-text-dark"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="font-display font-bold text-text-dark text-lg">
              {atual?.label}
            </h1>
          </div>

          {resumo && (
            <div className="px-5 sm:px-6 lg:px-8 pb-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Indicador rotulo="Clientes ativos" valor={resumo.clientesAtivos} />
              <Indicador rotulo="Em prospecção" valor={resumo.prospects} />
              <Indicador rotulo="Receita mensal" valor={dinheiro(resumo.receitaMensal)} />
              <Indicador rotulo="A receber" valor={dinheiro(resumo.aReceber)} />
              <Indicador
                rotulo="Cobranças vencidas"
                valor={resumo.cobrancasVencidas}
                alerta={resumo.cobrancasVencidas > 0}
              />
            </div>
          )}
        </header>

        <main className="px-5 sm:px-6 lg:px-8 py-6">
          {secao === 'ativos' && <Clientes situacao="ativo" aoMudar={carregarResumo} />}
          {secao === 'prospeccao' && <Clientes situacao="prospeccao" aoMudar={carregarResumo} />}
          {secao === 'financeiro' && <Financeiro aoMudar={carregarResumo} />}
          {secao === 'treinamentos' && (
            <div className="space-y-6">
              <Treinamentos />
              <AcessosTreinamento />
            </div>
          )}
          {secao === 'integracoes' && <Integracoes />}
          {secao === 'planos' && <Planos />}
          {secao === 'usuarios' && usuario.master && <Usuarios euId={usuario.id} />}
        </main>
      </div>
    </div>
  );
}

function ItemMenu({ ativo, onClick, Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-left transition-colors border-l-[3px] ${
        ativo
          ? 'bg-white/10 text-white border-amber-400'
          : 'text-purple-300 border-transparent hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
    </button>
  );
}

function Indicador({ rotulo, valor, alerta }) {
  return (
    <div className={`rounded-xl px-4 py-3 border ${
      alerta ? 'bg-red-50 border-red-200' : 'bg-purple-50 border-border-light'
    }`}>
      <p className="text-[10px] uppercase tracking-wider text-text-gray">{rotulo}</p>
      <p className={`font-display font-bold text-lg mt-0.5 ${alerta ? 'text-red-600' : 'text-text-dark'}`}>
        {valor}
      </p>
    </div>
  );
}
