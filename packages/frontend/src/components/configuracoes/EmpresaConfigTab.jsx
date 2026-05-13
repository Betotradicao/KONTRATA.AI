import { useState, useEffect } from 'react';
import { fetchMyCompany, updateMyCompany, fetchAllCompanies, createCompany, updateCompany, deleteCompany } from '../../services/companies.service';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import Logo from '../Logo';

export default function EmpresaConfigTab() {
  const { user, updateUser } = useAuth();
  const [empresaPrincipal, setEmpresaPrincipal] = useState(null);
  const [lojas, setLojas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Estados para modal de visualização
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingCompany, setViewingCompany] = useState(null);

  // Estados para modal de edição
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // Estados para segurança da conta (email e senha)
  const [securityData, setSecurityData] = useState({
    newEmail: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [securityError, setSecurityError] = useState(null);
  const [securitySuccess, setSecuritySuccess] = useState(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Estados para cadastro de nova loja
  const [showNewStoreForm, setShowNewStoreForm] = useState(false);
  const [newStoreData, setNewStoreData] = useState({
    nomeFantasia: '',
    razaoSocial: '',
    cnpj: '',
    codLoja: '',
    apelido: '',
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    telefone: '',
    email: '',
    fotoFachadaUrl: null,
    responsavelNome: '',
    responsavelEmail: '',
    responsavelTelefone: ''
  });
  const [uploadingFachadaNew, setUploadingFachadaNew] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Carregar empresa principal
      const empresa = await fetchMyCompany();
      setEmpresaPrincipal(empresa);

      // Se for master, carregar todas as lojas/empresas
      if (user?.isMaster) {
        try {
          const allCompanies = await fetchAllCompanies();
          // Filtra para mostrar apenas as lojas adicionais (excluindo a principal)
          if (empresa && allCompanies) {
            const lojasAdicionais = allCompanies.filter(c => c.id !== empresa.id);
            setLojas(lojasAdicionais);
          }
        } catch (err) {
          console.log('Não foi possível carregar lojas adicionais');
        }
      }
    } catch (err) {
      setError('Erro ao carregar dados da empresa');
      console.error('Load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = (company) => {
    setViewingCompany(company);
    setShowViewModal(true);
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setEditFormData({
      nomeFantasia: company.nomeFantasia || '',
      razaoSocial: company.razaoSocial || '',
      cnpj: company.cnpj || '',
      codLoja: company.codLoja ?? '',
      apelido: company.apelido || '',
      cep: company.cep || '',
      rua: company.rua || '',
      numero: company.numero || '',
      complemento: company.complemento || '',
      bairro: company.bairro || '',
      cidade: company.cidade || '',
      estado: company.estado || '',
      telefone: company.telefone || '',
      email: company.email || '',
      responsavelNome: company.responsavelNome || '',
      responsavelEmail: company.responsavelEmail || '',
      responsavelTelefone: company.responsavelTelefone || '',
      metaChecklist: company.metaChecklist != null ? company.metaChecklist : 95,
      fotoFachadaUrl: company.fotoFachadaUrl || null
    });
    setShowEditModal(true);
  };

  // Upload da foto da fachada da loja
  const [uploadingFachada, setUploadingFachada] = useState(false);
  const handleUploadFachada = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFachada(true);
    try {
      const fd = new FormData();
      fd.append('imagem', file);
      const res = await api.post('/checklist/upload-imagem', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.url) {
        setEditFormData(f => ({ ...f, fotoFachadaUrl: res.data.url }));
      }
    } catch (err) {
      setError('Erro ao enviar foto da fachada.');
    } finally {
      setUploadingFachada(false);
      e.target.value = '';
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      console.log('📤 Salvando empresa - editFormData:', editFormData);
      console.log('📤 codLoja:', editFormData.codLoja, 'apelido:', editFormData.apelido);

      if (editingCompany.id === empresaPrincipal?.id) {
        // Atualizar empresa principal
        await updateMyCompany(editFormData);
      } else {
        // Atualizar loja adicional
        await updateCompany(editingCompany.id, editFormData);
      }

      setSuccess('Dados atualizados com sucesso!');
      setShowEditModal(false);
      await loadData();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao atualizar dados');
    }
  };

  const handleNewStoreChange = (e) => {
    const { name, value } = e.target;
    setNewStoreData(prev => ({ ...prev, [name]: value }));
  };

  // Upload da foto da fachada no cadastro de nova loja
  const handleUploadFachadaNew = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFachadaNew(true);
    try {
      const fd = new FormData();
      fd.append('imagem', file);
      const res = await api.post('/checklist/upload-imagem', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.url) {
        setNewStoreData(f => ({ ...f, fotoFachadaUrl: res.data.url }));
      }
    } catch (err) {
      setError('Erro ao enviar foto da fachada.');
    } finally {
      setUploadingFachadaNew(false);
      e.target.value = '';
    }
  };

  // Calcula o proximo numero de loja automaticamente (max + 1)
  const getProximoCodLoja = () => {
    const numeros = [
      empresaPrincipal?.codLoja,
      ...lojas.map(l => l.codLoja),
    ].map(n => (n != null && !isNaN(Number(n)) ? Number(n) : null))
     .filter(n => n != null);
    return numeros.length ? Math.max(...numeros) + 1 : 1;
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    try {
      setError(null);

      // Nenhum campo obrigatorio - cod_loja e definido automaticamente
      const payload = {
        ...newStoreData,
        codLoja: newStoreData.codLoja !== '' ? newStoreData.codLoja : getProximoCodLoja(),
      };

      await createCompany(payload);

      setSuccess('Nova loja cadastrada com sucesso!');
      setShowNewStoreForm(false);
      setNewStoreData({
        nomeFantasia: '',
        razaoSocial: '',
        cnpj: '',
        codLoja: '',
        apelido: '',
        cep: '',
        rua: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: '',
        telefone: '',
        email: '',
        fotoFachadaUrl: null,
        responsavelNome: '',
        responsavelEmail: '',
        responsavelTelefone: ''
      });
      await loadData();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao cadastrar loja');
    }
  };

  const handleDeleteStore = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta loja?')) return;

    try {
      await deleteCompany(id);
      setSuccess('Loja excluída com sucesso!');
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao excluir loja');
    }
  };

  // Função para trocar email de recuperação
  const handleChangeEmail = async (e) => {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);

    if (!securityData.newEmail) {
      setSecurityError('Digite o novo email');
      return;
    }

    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(securityData.newEmail)) {
      setSecurityError('Digite um email válido');
      return;
    }

    try {
      console.log('Atualizando email para:', securityData.newEmail);
      const response = await api.put('/auth/update-profile', {
        email: securityData.newEmail
      });
      console.log('Resposta da API:', response.data);

      setSecuritySuccess('Email de recuperação atualizado com sucesso!');
      setIsChangingEmail(false);
      setSecurityData(prev => ({ ...prev, newEmail: '' }));

      // Atualizar dados do usuário no contexto
      if (updateUser) {
        updateUser({ email: securityData.newEmail });
      }

      setTimeout(() => setSecuritySuccess(null), 5000);
    } catch (err) {
      console.error('Erro ao atualizar email:', err);
      const errorMsg = err.response?.data?.error || 'Erro ao atualizar email. Verifique sua conexão.';
      setSecurityError(errorMsg);
    }
  };

  // Função para trocar senha
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);

    if (!securityData.currentPassword) {
      setSecurityError('Digite a senha atual');
      return;
    }

    if (!securityData.newPassword) {
      setSecurityError('Digite a nova senha');
      return;
    }

    if (securityData.newPassword.length < 6) {
      setSecurityError('A nova senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (securityData.newPassword !== securityData.confirmPassword) {
      setSecurityError('As senhas não coincidem');
      return;
    }

    try {
      await api.put('/auth/update-profile', {
        currentPassword: securityData.currentPassword,
        newPassword: securityData.newPassword
      });

      setSecuritySuccess('Senha alterada com sucesso!');
      setIsChangingPassword(false);
      setSecurityData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));

      setTimeout(() => setSecuritySuccess(null), 3000);
    } catch (err) {
      setSecurityError(err.response?.data?.error || 'Erro ao alterar senha');
    }
  };

  // Resetar estados de segurança ao fechar modal
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setIsChangingEmail(false);
    setIsChangingPassword(false);
    setSecurityData({
      newEmail: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setSecurityError(null);
    setSecuritySuccess(null);
  };

  // Estado para personalização White Label (hooks ANTES de qualquer return condicional)
  const [brandName, setBrandName] = useState('');
  const [brandNameSaved, setBrandNameSaved] = useState('');
  const [brandLogo, setBrandLogo] = useState('');
  const [brandLogoSaved, setBrandLogoSaved] = useState('');
  const [isSavingBrand, setIsSavingBrand] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  useEffect(() => {
    api.get('/config/configurations')
      .then(res => {
        const configs = res.data?.data || res.data || {};
        if (configs.client_brand_name) { setBrandName(configs.client_brand_name); setBrandNameSaved(configs.client_brand_name); }
        if (configs.client_logo_url) { setBrandLogo(configs.client_logo_url); setBrandLogoSaved(configs.client_logo_url); }
      })
      .catch(() => {});
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const saveBrandName = async () => {
    setIsSavingBrand(true);
    try {
      await api.post('/config/configurations', { client_brand_name: brandName || '', client_logo_url: brandLogo || '' });
      setBrandNameSaved(brandName);
      setBrandLogoSaved(brandLogo);
      if (Logo.clearCache) Logo.clearCache();
      setSuccess('Personalização salva! A página vai recarregar...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setError('Erro ao salvar nome da marca');
      setTimeout(() => setError(null), 3000);
    }
    setIsSavingBrand(false);
  };

  const restoreLogo = async () => {
    setBrandName('');
    setBrandLogo('');
    setIsSavingBrand(true);
    try {
      await api.post('/config/configurations', { client_brand_name: '', client_logo_url: '' });
      setBrandNameSaved('');
      setBrandLogoSaved('');
      // Limpar cache do Logo pra nao piscar o antigo
      if (Logo.clearCache) Logo.clearCache();
      setSuccess('Logo restaurado para Radar 360! A página vai recarregar...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setError('Erro ao restaurar');
      setTimeout(() => setError(null), 3000);
    }
    setIsSavingBrand(false);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      {/* Seção: Personalização White Label */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Personalização do Sistema</h2>
        <p className="text-sm text-gray-500 mb-4">
          Personalize o logo e nome que aparecem no menu lateral. Deixe vazio para usar o padrão (Radar 360).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Logo da Empresa</label>
            <div className="flex items-center gap-4">
              {/* Preview */}
              <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
                {brandLogo ? (
                  <img src={brandLogo} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition text-sm font-medium inline-block text-center">
                  {isUploadingLogo ? 'Enviando...' : 'Enviar Logo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    disabled={isUploadingLogo}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 500 * 1024) { setError('Imagem muito grande (max 500KB)'); setTimeout(() => setError(null), 3000); return; }
                      setIsUploadingLogo(true);
                      try {
                        // Converte pra base64 e salva direto na config (sem MinIO)
                        const reader = new FileReader();
                        reader.onload = async () => {
                          const base64 = reader.result;
                          setBrandLogo(base64);
                          setIsUploadingLogo(false);
                          setSuccess('Logo carregado! Clique em Salvar para aplicar.');
                          setTimeout(() => setSuccess(null), 3000);
                        };
                        reader.onerror = () => {
                          setError('Erro ao ler imagem');
                          setTimeout(() => setError(null), 3000);
                          setIsUploadingLogo(false);
                        };
                        reader.readAsDataURL(file);
                      } catch (err) {
                        setError('Erro ao processar logo');
                        setTimeout(() => setError(null), 3000);
                        setIsUploadingLogo(false);
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
                <p className="text-xs text-gray-400">PNG, JPG ou SVG. Max 500KB.</p>
              </div>
            </div>
          </div>

          {/* Nome da Marca */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Empresa / Marca</label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Ex: SUPERMERCADO NUNES"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              maxLength={50}
            />
            <p className="text-xs text-gray-400 mt-1">Aparece embaixo do logo no menu lateral</p>
          </div>
        </div>

        {/* Botões */}
        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={saveBrandName}
            disabled={isSavingBrand || (brandName === brandNameSaved && brandLogo === brandLogoSaved)}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg transition font-medium"
          >
            {isSavingBrand ? 'Salvando...' : 'Salvar'}
          </button>
          {(brandNameSaved || brandLogoSaved) && (
            <button
              onClick={restoreLogo}
              disabled={isSavingBrand}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition text-sm flex items-center gap-2"
              title="Restaurar logo e nome originais (Radar 360)"
            >
              <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center">
                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="4"/>
                  <path d="M12 12l7-7"/><circle cx="12" cy="12" r="1" fill="currentColor"/>
                </svg>
              </div>
              Restaurar Logo Original (Radar 360)
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
