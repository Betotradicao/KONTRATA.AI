import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import PasswordRequirements from '../PasswordRequirements';
import { passwordValidationError } from '../../utils/passwordPolicy';

export default function UserSecuritySettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Security settings
  const [securityData, setSecurityData] = useState(null);

  // Recovery email form
  const [recoveryEmail, setRecoveryEmail] = useState('');

  // Change password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState(false);

  // SMTP settings (admin only)
  const [smtpData, setSmtpData] = useState({
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    smtpSecure: true,
    smtpFromEmail: '',
    smtpFromName: 'Kontrata.ai',
  });
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  // Active section
  const [activeSection, setActiveSection] = useState('recovery');

  useEffect(() => {
    loadSecuritySettings();
    if (user?.role === 'admin') {
      loadSmtpSettings();
    }
  }, [user]);

  const loadSecuritySettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/user-security/settings');
      setSecurityData(response.data);
      setRecoveryEmail(response.data.recoveryEmail || '');
    } catch (err) {
      setError('Erro ao carregar configurações de segurança');
    } finally {
      setLoading(false);
    }
  };

  const loadSmtpSettings = async () => {
    try {
      const response = await api.get('/user-security/smtp-settings');
      if (response.data.configured) {
        setSmtpData({
          smtpHost: response.data.smtpHost || '',
          smtpPort: response.data.smtpPort || '587',
          smtpUser: response.data.smtpUser || '',
          smtpPassword: '', // Never load password
          smtpSecure: response.data.smtpSecure !== false,
          smtpFromEmail: response.data.smtpFromEmail || '',
          smtpFromName: response.data.smtpFromName || 'Kontrata.ai',
        });
      }
    } catch (err) {
      console.error('Erro ao carregar configurações SMTP:', err);
    }
  };

  const handleUpdateRecoveryEmail = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await api.put('/user-security/recovery-email', { recoveryEmail });
      setSuccess('Email de recuperação atualizado com sucesso!');
      loadSecuritySettings();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao atualizar email de recuperação');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const pwdErr = passwordValidationError(passwordForm.newPassword);
    if (pwdErr) {
      setError(pwdErr);
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setSaving(true);

    try {
      await api.post('/user-security/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setSuccess('Senha alterada com sucesso!');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao alterar senha');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSmtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await api.put('/user-security/smtp-settings', smtpData);
      setSuccess('Configurações SMTP atualizadas com sucesso!');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao atualizar configurações SMTP');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Carregando configurações...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900">Segurança da Conta</h3>
        <p className="mt-1 text-sm text-gray-500">
          Gerencie suas configurações de segurança, email de recuperação e senha
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="ml-3 text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="ml-3 text-sm text-green-800">{success}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveSection('recovery')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeSection === 'recovery'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Email de Recuperação
          </button>
          <button
            onClick={() => setActiveSection('password')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeSection === 'password'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Alterar Senha
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => setActiveSection('smtp')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeSection === 'smtp'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Configurar Email (SMTP)
            </button>
          )}
        </nav>
      </div>

      {/* Recovery Email Section */}
      {activeSection === 'recovery' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h4 className="text-base font-medium text-gray-900 mb-4">Email de Recuperação</h4>
          <p className="text-sm text-gray-500 mb-6">
            Este email será usado para recuperação de senha. Certifique-se de que você tem acesso a ele.
          </p>

          <form onSubmit={handleUpdateRecoveryEmail} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Atual de Recuperação
              </label>
              <input
                type="email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="seu-email@exemplo.com"
                required
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-xs text-blue-800">
                💡 Se você esquecer sua senha, enviaremos um link de recuperação para este email
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors font-medium"
            >
              {saving ? 'Salvando...' : 'Atualizar Email'}
            </button>
          </form>
        </div>
      )}

      {/* Change Password Section */}
      {activeSection === 'password' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h4 className="text-base font-medium text-gray-900 mb-4">Alterar Senha</h4>
          <p className="text-sm text-gray-500 mb-6">
            Para sua segurança, você precisará informar sua senha atual.
          </p>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senha Atual
              </label>
              <div className="relative">
                <input
                  type={showPasswords ? "text" : "password"}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Digite sua senha atual"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nova Senha
              </label>
              <input
                type={showPasswords ? "text" : "password"}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Senha forte"
                required
              />
              <PasswordRequirements password={passwordForm.newPassword} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar Nova Senha
              </label>
              <input
                type={showPasswords ? "text" : "password"}
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Digite novamente"
                required
              />
              {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">As senhas não coincidem</p>
              )}
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={showPasswords}
                onChange={(e) => setShowPasswords(e.target.checked)}
                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <label className="ml-2 text-sm text-gray-700">
                Mostrar senhas
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors font-medium"
            >
              {saving ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </form>

          {securityData?.lastPasswordChange && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Última alteração de senha:{' '}
                <span className="font-medium text-gray-900">
                  {new Date(securityData.lastPasswordChange).toLocaleString('pt-BR')}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* SMTP Settings Section (Admin Only) */}
      {activeSection === 'smtp' && user?.role === 'admin' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h4 className="text-base font-medium text-gray-900 mb-4">Configurações de Email (SMTP)</h4>
          <p className="text-sm text-gray-500 mb-6">
            Configure o servidor de email para envio de recuperação de senha e notificações.
          </p>

          <form onSubmit={handleUpdateSmtp} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Servidor SMTP
                </label>
                <input
                  type="text"
                  value={smtpData.smtpHost}
                  onChange={(e) => setSmtpData({...smtpData, smtpHost: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="smtp.gmail.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Porta
                </label>
                <input
                  type="number"
                  value={smtpData.smtpPort}
                  onChange={(e) => setSmtpData({...smtpData, smtpPort: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center space-x-3 pb-3">
                  <input
                    type="checkbox"
                    checked={smtpData.smtpSecure}
                    onChange={(e) => setSmtpData({...smtpData, smtpSecure: e.target.checked})}
                    className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Usar SSL/TLS</span>
                </label>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Usuário SMTP
                </label>
                <input
                  type="text"
                  value={smtpData.smtpUser}
                  onChange={(e) => setSmtpData({...smtpData, smtpUser: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Senha SMTP (deixe em branco para manter a atual)
                </label>
                <div className="relative">
                  <input
                    type={showSmtpPassword ? "text" : "password"}
                    value={smtpData.smtpPassword}
                    onChange={(e) => setSmtpData({...smtpData, smtpPassword: e.target.value})}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showSmtpPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email de Envio
                </label>
                <input
                  type="email"
                  value={smtpData.smtpFromEmail}
                  onChange={(e) => setSmtpData({...smtpData, smtpFromEmail: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Remetente
                </label>
                <input
                  type="text"
                  value={smtpData.smtpFromName}
                  onChange={(e) => setSmtpData({...smtpData, smtpFromName: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors font-medium"
            >
              {saving ? 'Salvando...' : 'Atualizar Configurações SMTP'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
