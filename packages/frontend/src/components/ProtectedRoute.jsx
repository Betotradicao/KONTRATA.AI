import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isModuleActive } from '../utils/modulesConfig';

/**
 * Protege rota por:
 *   1. Autenticacao (sempre)
 *   2. Modulo ativo (opcional, via prop moduleId)
 *
 * Se modulo nao esta ativo pro cliente, redireciona pra primeira tela permitida.
 * Master sempre passa.
 */
export default function ProtectedRoute({ children, moduleId }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-lg text-gray-600">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Verifica autorizacao por modulo (se moduleId foi passado)
  const isMaster = user?.isMaster || user?.role === 'master';
  if (moduleId && !isModuleActive(moduleId, { isMaster })) {
    return <Navigate to={findFirstAllowedPath({ isMaster })} replace />;
  }

  return children;
}

/**
 * Redireciona TODOS pra Configuracoes de RH (tela padrao acessivel a todos).
 * Usado em '/', '/dashboard', '*' (catch-all).
 *
 * Decisao: simplificar — antes tentava achar "primeira tela permitida"
 * dinamicamente, mas isso causava bugs com cache de localStorage + lentidao
 * de fetch. Configuracoes de RH sempre esta liberada pra todos os usuarios
 * (master e employees), entao serve como landing page neutra e previsivel.
 */
export function RedirectToFirstAllowed() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to="/rh/configuracoes" replace />;
}