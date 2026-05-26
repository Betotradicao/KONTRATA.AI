import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      // Se tiver token no localStorage, considerar como logado
      // Em uma implementação real, você verificaria se o token é válido
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    }
    setLoading(false);
  }, [token]);

  const login = async (email, password) => {
    try {
      // Limpar TUDO antes de fazer novo login (evita dados de usuário anterior)
      // Inclui modules_config e modules_visibility_mode pra nao vazar
      // permissoes do usuario anterior pro novo (bug: BETO via menu de master)
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('modules_config');
      localStorage.removeItem('modules_visibility_mode');

      const response = await api.post('/auth/login', { email, password });
      const { token: newToken, user: userData } = response.data;

      // Salvar no localStorage primeiro
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));

      // Forçar reload completo da página para garantir que tudo seja remontado
      // com os dados do novo usuário (evita cache de componentes)
      window.location.href = '/dashboard';

      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Erro ao fazer login';
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Limpa cache de modulos tambem pra nao vazar permissoes pro proximo user
    localStorage.removeItem('modules_config');
    localStorage.removeItem('modules_visibility_mode');
  };

  const updateUser = (updatedData) => {
    const updatedUser = { ...user, ...updatedData };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  // Função para verificar se usuário tem permissão
  const hasPermission = (moduleId, submenuId = null) => {
    // Admin e Master sempre têm acesso total
    if (user?.type === 'admin' || user?.isMaster) return true;

    // Employees verificam permissões
    if (user?.type === 'employee') {
      if (!user.permissions) return false;

      const modulePerms = user.permissions[moduleId];
      if (!modulePerms) return false; // Sem permissão no módulo

      // Se submenuId não especificado, verifica se tem acesso ao módulo
      if (!submenuId) return true;

      // Se modulePerms é array vazio = acesso total ao módulo
      if (Array.isArray(modulePerms) && modulePerms.length === 0) return true;

      // Verifica se tem permissão específica no sub-menu
      return Array.isArray(modulePerms) && modulePerms.includes(submenuId);
    }

    return false;
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    updateUser,
    hasPermission,
    isAuthenticated: !!token
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};