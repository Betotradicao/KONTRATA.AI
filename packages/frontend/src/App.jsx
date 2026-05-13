import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LojaProvider } from './contexts/LojaContext';
import ProtectedRoute from './components/ProtectedRoute';

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
              <Route path="/rh/indicadores" element={<ProtectedRoute><RhIndicadores /></ProtectedRoute>} />
              <Route path="/rh/dashboard" element={<ProtectedRoute><RhDashboard /></ProtectedRoute>} />

              {/* RH — Colaboradores */}
              <Route path="/rh/cadastro" element={<ProtectedRoute><RhCadastroGeral /></ProtectedRoute>} />
              <Route path="/rh/resultados" element={<ProtectedRoute><RhResultados /></ProtectedRoute>} />
              <Route path="/rh/admissoes" element={<ProtectedRoute><RhAdmissoes /></ProtectedRoute>} />
              <Route path="/rh/desligamentos" element={<ProtectedRoute><RhDesligamentos /></ProtectedRoute>} />
              <Route path="/rh/documentacao" element={<ProtectedRoute><RhDocumentacao /></ProtectedRoute>} />

              {/* RH — Ponto e Ausencias */}
              <Route path="/rh/ausencias" element={<ProtectedRoute><RhAusencias /></ProtectedRoute>} />
              <Route path="/rh/aso" element={<ProtectedRoute><RhControleASO /></ProtectedRoute>} />

              {/* RH — Curriculos */}
              <Route path="/rh/curriculos" element={<ProtectedRoute><BancoCurriculos /></ProtectedRoute>} />
              <Route path="/rh/modelo-curriculo" element={<ProtectedRoute><ModeloCurriculo /></ProtectedRoute>} />

              {/* RH — Recrutamento */}
              <Route path="/rh/vagas" element={<ProtectedRoute><RhVagas /></ProtectedRoute>} />
              <Route path="/rh/recrutador" element={<ProtectedRoute><RhRecrutadorIA /></ProtectedRoute>} />
              <Route path="/rh/recrutador/:tab" element={<ProtectedRoute><RhRecrutadorIA /></ProtectedRoute>} />

              {/* RH — Pesquisa de Clima */}
              <Route path="/rh/pesquisa-clima/criar" element={<ProtectedRoute><PesquisaClimaCriar /></ProtectedRoute>} />
              <Route path="/rh/pesquisa-clima/analise" element={<ProtectedRoute><PesquisaClimaAnalise /></ProtectedRoute>} />

              {/* RH — Treinamentos */}
              <Route path="/rh/treinamentos" element={<ProtectedRoute><RhTreinamentos /></ProtectedRoute>} />

              {/* RH — Financeiro */}
              <Route path="/rh/lancamentos" element={<ProtectedRoute><RhLancamentos /></ProtectedRoute>} />
              <Route path="/rh/folha" element={<ProtectedRoute><RhFolhaPagamento /></ProtectedRoute>} />

              {/* RH — Escala de Trabalho */}
              <Route path="/rh/escala" element={<ProtectedRoute><RhEscala /></ProtectedRoute>} />
              <Route path="/rh/escala/template" element={<ProtectedRoute><RhEscalaTemplate /></ProtectedRoute>} />
              <Route path="/rh/escala/eventos" element={<ProtectedRoute><RhEscalaEventos /></ProtectedRoute>} />

              {/* RH — Departamento Pessoal */}
              <Route path="/rh/departamento-pessoal" element={<ProtectedRoute><RhDepartamentoPessoal /></ProtectedRoute>} />

              {/* RH — Metodo DISC */}
              <Route path="/rh/metodo-disc" element={<ProtectedRoute><RhMetodoDisc /></ProtectedRoute>} />
              <Route path="/rh/metodo-disc/resultados" element={<ProtectedRoute><RhMetodoDiscResultados /></ProtectedRoute>} />

              {/* RH — Configuracoes */}
              <Route path="/rh/configuracoes" element={<ProtectedRoute><RhConfiguracoes /></ProtectedRoute>} />

              {/* RH — Placeholders pra modulos ainda nao implementados */}
              <Route path="/rh/beneficios" element={<ProtectedRoute><RhPlaceholder title="Benefícios" subtitle="Gestão de benefícios" features={['Vale transporte', 'Vale refeição', 'Plano de saúde']} /></ProtectedRoute>} />
              <Route path="/rh/rotatividade" element={<ProtectedRoute><RhPlaceholder title="Rotatividade (Turnover)" subtitle="Indicadores de rotatividade" features={['Taxa de turnover', 'Evolução mensal']} /></ProtectedRoute>} />
              <Route path="/rh/perfil" element={<ProtectedRoute><RhPlaceholder title="Perfil Demográfico" subtitle="Perfil do quadro" features={['Distribuição', 'Tempo de casa']} /></ProtectedRoute>} />

              {/* Dashboard antigo NÃO existe mais — raiz e /dashboard redirecionam pro RH */}
              <Route path="/dashboard" element={<Navigate to="/rh/indicadores" replace />} />
              <Route path="/" element={<Navigate to="/rh/indicadores" replace />} />
              <Route path="*" element={<Navigate to="/rh/indicadores" replace />} />
            </Routes>
        </LojaProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
