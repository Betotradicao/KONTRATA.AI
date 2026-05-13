import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

const LojaContext = createContext({});

export const useLoja = () => {
  const context = useContext(LojaContext);
  if (!context) {
    throw new Error('useLoja must be used within a LojaProvider');
  }
  return context;
};

export const LojaProvider = ({ children }) => {
  const [lojas, setLojas] = useState([]);
  const [lojaSelecionada, setLojaSelecionada] = useState(null); // null = TODAS
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Só carregar lojas se tiver token de autenticação
    const token = localStorage.getItem('token');
    if (token) {
      carregarLojas();
    } else {
      setLoading(false);
    }

    // Listener para detectar mudanças no localStorage (login/logout)
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        if (e.newValue) {
          // Token adicionado = login
          carregarLojas();
        } else {
          // Token removido = logout
          setLojas([]);
          setLojaSelecionada(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const carregarLojas = async () => {
    try {
      console.log('📍 [LojaContext] Carregando lojas de rh_empresas...');
      const response = await api.get('/rh/empresas/stores/list');
      // Adapta {cod_loja, nome_fantasia, apelido} → {COD_LOJA, DES_LOJA, APELIDO}
      const mapped = (response.data || []).map(s => ({
        COD_LOJA: s.cod_loja,
        DES_LOJA: s.nome_fantasia || s.razao_social || `Loja ${s.cod_loja}`,
        APELIDO: s.apelido,
      }));
      setLojas(mapped);

      // Verificar se tem loja salva no localStorage
      const lojaSalva = localStorage.getItem('lojaSelecionada');
      if (lojaSalva && lojaSalva !== 'null') {
        setLojaSelecionada(parseInt(lojaSalva));
      }
    } catch (error) {
      console.error('❌ [LojaContext] Erro ao carregar lojas:', error);
      setLojas([]);
    } finally {
      setLoading(false);
    }
  };

  const selecionarLoja = (codLoja) => {
    setLojaSelecionada(codLoja);
    if (codLoja === null) {
      localStorage.removeItem('lojaSelecionada');
    } else {
      localStorage.setItem('lojaSelecionada', codLoja.toString());
    }
  };

  const getLojaLabel = () => {
    if (lojaSelecionada === null) return 'TODAS';
    const loja = lojas.find(l => l.COD_LOJA === lojaSelecionada);
    if (!loja) return 'TODAS';
    // Incluir apelido se existir
    if (loja.APELIDO) {
      return `LOJA ${loja.COD_LOJA} - ${loja.APELIDO}`;
    }
    return `LOJA ${loja.COD_LOJA}`;
  };

  // Retorna a loja atual completa (ou null se TODAS)
  const lojaAtual = lojaSelecionada !== null
    ? lojas.find(l => l.COD_LOJA === lojaSelecionada) || null
    : null;

  const value = {
    lojas,
    lojaSelecionada,
    lojaAtual,
    loading,
    selecionarLoja,
    getLojaLabel,
    carregarLojas
  };

  return (
    <LojaContext.Provider value={value}>
      {children}
    </LojaContext.Provider>
  );
};
