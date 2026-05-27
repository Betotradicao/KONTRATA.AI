import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LojaProvider } from './contexts/LojaContext';
import ProtectedRoute, { RedirectToFirstAllowed } from './components/ProtectedRoute';

// Auth / Core
import Login from './pages/Login';
import AdminSetup from './pages/AdminSetup';
import CadastroColaborador from './pages/CadastroColaborador';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Perfil from './pages/Perfil';
import Configuracoes from './pages/Configuracoes';
import ConfiguracoesRede from './pages/ConfiguracoesRede';
import AlertaResolucao from './pages/AlertaResolucao';

// Publicas (sem auth)
import CurriculoPublico from './pages/CurriculoPublico';
import DiscPublico from './pages/DiscPublico';
import PesquisaPublica from './pages/PesquisaPublica';
import RecrutamentoPublico from './pages/RecrutamentoPublico';

// RH (todas as páginas Rh*)
import RhDashboard from './pages/RhDashboard';
import RhIndicadores from './pages/RhIndicadores';
import RhCadastroGeral from './pages/RhCadastroGeral';
import RhResultados from './pages/RhResultados';
import RhAdmissoes from './pages/RhAdmissoes';
import RhDesligamentos from './pages/RhDesligamentos';
import RhAusencias from './pages/RhAusencias';
import RhControleASO from './pages/RhControleASO';
import RhDocumentacao from './pages/RhDocumentacao';
import RhDepartamentoPessoal from './pages/RhDepartamentoPessoal';
import RhLancamentos from './pages/RhLancamentos';
import RhEscala from './pages/RhEscala';
import RhEscalaTemplate from './pages/RhEscalaTemplate';
import RhEscalaEventos from './pages/RhEscalaEventos';
import RhFolhaPagamento from './pages/RhFolhaPagamento';
import RhConfiguracoes from './pages/RhConfiguracoes';
import RhMetodoDisc from './pages/RhMetodoDisc';
import RhMetodoDiscResultados from './pages/RhMetodoDiscResultados';
import RhVagas from './pages/RhVagas';
import RhTreinamentos from './pages/RhTreinamentos';
import RhRecrutadorIA from './pages/RhRecrutadorIA';
import RhPlaceholder from './pages/RhPlaceholder';

// Subpasta rh/
import ModeloCurriculo from './pages/rh/ModeloCurriculo';
import BancoCurriculos from './pages/rh/BancoCurriculos';
import PesquisaClimaCriar from './pages/rh/PesquisaClimaCriar';
import PesquisaClimaAnalise from './pages/rh/PesquisaClimaAnalise';
import AnaliseNr1 from './pages/rh/AnaliseNr1';

function App() {
  return (
    <Router>
      <AuthProvider>
        <LojaProvider>
            <Routes>
              {/* Public Routes (sem auth) */}
              <Route path="/admin-setup/:token" element={<AdminSetup />} />
              <Route path="/cadastro/:token" element={<CadastroColaborador />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/alerta/:token" element={<AlertaResolucao />} />
              <Route path="/curriculo" element={<CurriculoPublico />} />
              <Route path="/disc" element={<DiscPublico />} />
              <Route path="/pesquisa-publica/:token" element={<PesquisaPublica />} />
              <Route path="/recrutamento/:token" element={<RecrutamentoPublico />} />

              {/* Protected — Auth & Perfil */}
              <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
              <Route path="/configuracoes-rede" element={<ProtectedRoute><ConfiguracoesRede /></ProtectedRoute>} />

              {/* RH — Indicadores */}
              <Route path="/rh/indicadores" element={<ProtectedRoute moduleId="rh-indicadores"><RhIndicadores /></ProtectedRoute>} />
              <Route path="/rh/dashboard" element={<ProtectedRoute moduleId="rh-indicadores"><RhDashboard /></ProtectedRoute>} />

              {/* RH — Colaboradores (cada submenu tem moduleId proprio) */}
              <Route path="/rh/cadastro" element={<ProtectedRoute moduleId="rh-cadastro-geral"><RhCadastroGeral /></ProtectedRoute>} />
              <Route path="/rh/resultados" element={<ProtectedRoute moduleId="rh-cadastro-geral"><RhResultados /></ProtectedRoute>} />
              <Route path="/rh/admissoes" element={<ProtectedRoute moduleId="rh-cadastro-geral"><RhAdmissoes /></ProtectedRoute>} />
              <Route path="/rh/desligamentos" element={<ProtectedRoute moduleId="rh-cadastro-geral"><RhDesligamentos /></ProtectedRoute>} />
              <Route path="/rh/documentacao" element={<ProtectedRoute moduleId="rh-documentacao"><RhDocumentacao /></ProtectedRoute>} />

              {/* RH — Ponto e Ausencias */}
              <Route path="/rh/ausencias" element={<ProtectedRoute moduleId="rh-ausencias"><RhAusencias /></ProtectedRoute>} />
              <Route path="/rh/aso" element={<ProtectedRoute moduleId="rh-saude"><RhControleASO /></ProtectedRoute>} />

              {/* RH — Curriculos / Recrutamento (cada subitem tem moduleId especifico) */}
              <Route path="/rh/curriculos" element={<ProtectedRoute moduleId="rh-curriculo-banco"><BancoCurriculos /></ProtectedRoute>} />
              <Route path="/rh/modelo-curriculo" element={<ProtectedRoute moduleId="rh-curriculo-modelo"><ModeloCurriculo /></ProtectedRoute>} />
              <Route path="/rh/vagas" element={<ProtectedRoute moduleId="rh-vagas"><RhVagas /></ProtectedRoute>} />
              <Route path="/rh/recrutador" element={<ProtectedRoute moduleId="rh-recrutador-ia"><RhRecrutadorIA /></ProtectedRoute>} />
              <Route path="/rh/recrutador/:tab" element={<ProtectedRoute moduleId="rh-recrutador-ia"><RhRecrutadorIA /></ProtectedRoute>} />

              {/* RH — Pesquisa de Clima */}
              <Route path="/rh/pesquisa-clima/criar" element={<ProtectedRoute moduleId="rh-clima-criar"><PesquisaClimaCriar /></ProtectedRoute>} />
              <Route path="/rh/pesquisa-clima/analise" element={<ProtectedRoute moduleId="rh-clima-analise"><PesquisaClimaAnalise /></ProtectedRoute>} />
              <Route path="/rh/pesquisa-clima/nr1" element={<ProtectedRoute moduleId="rh-clima-nr1"><AnaliseNr1 /></ProtectedRoute>} />

              {/* RH — Treinamentos */}
              <Route path="/rh/treinamentos" element={<ProtectedRoute moduleId="rh-cadastro-treinamento"><RhTreinamentos /></ProtectedRoute>} />

              {/* RH — Financeiro */}
              <Route path="/rh/lancamentos" element={<ProtectedRoute moduleId="rh-lancamentos"><RhLancamentos /></ProtectedRoute>} />
              <Route path="/rh/folha" element={<ProtectedRoute moduleId="rh-folha"><RhFolhaPagamento /></ProtectedRoute>} />

              {/* RH — Escala de Trabalho */}
              <Route path="/rh/escala" element={<ProtectedRoute moduleId="rh-escala-grid"><RhEscala /></ProtectedRoute>} />
              <Route path="/rh/escala/template" element={<ProtectedRoute moduleId="rh-escala-grid"><RhEscalaTemplate /></ProtectedRoute>} />
              <Route path="/rh/escala/eventos" element={<ProtectedRoute moduleId="rh-escala-eventos"><RhEscalaEventos /></ProtectedRoute>} />

              {/* RH — Departamento Pessoal */}
              <Route path="/rh/departamento-pessoal" element={<ProtectedRoute moduleId="rh-dp"><RhDepartamentoPessoal /></ProtectedRoute>} />

              {/* RH — Metodo DISC (parte de Recrutamento, subitem proprio) */}
              <Route path="/rh/metodo-disc" element={<ProtectedRoute moduleId="rh-metodo-disc"><RhMetodoDisc /></ProtectedRoute>} />
              <Route path="/rh/metodo-disc/resultados" element={<ProtectedRoute moduleId="rh-metodo-disc"><RhMetodoDiscResultados /></ProtectedRoute>} />

              {/* RH — Configuracoes */}
              <Route path="/rh/configuracoes" element={<ProtectedRoute><RhConfiguracoes /></ProtectedRoute>} />

              {/* RH — Placeholders pra modulos ainda nao implementados */}
              <Route path="/rh/beneficios" element={<ProtectedRoute><RhPlaceholder title="Benefícios" subtitle="Gestão de benefícios" features={['Vale transporte', 'Vale refeição', 'Plano de saúde']} /></ProtectedRoute>} />
              <Route path="/rh/rotatividade" element={<ProtectedRoute><RhPlaceholder title="Rotatividade (Turnover)" subtitle="Indicadores de rotatividade" features={['Taxa de turnover', 'Evolução mensal']} /></ProtectedRoute>} />
              <Route path="/rh/perfil" element={<ProtectedRoute><RhPlaceholder title="Perfil Demográfico" subtitle="Perfil do quadro" features={['Distribuição', 'Tempo de casa']} /></ProtectedRoute>} />

              {/* Raiz e /dashboard redirecionam pra PRIMEIRA TELA PERMITIDA do usuario */}
              <Route path="/dashboard" element={<RedirectToFirstAllowed />} />
              <Route path="/" element={<RedirectToFirstAllowed />} />
              <Route path="*" element={<RedirectToFirstAllowed />} />
            </Routes>
        </LojaProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
