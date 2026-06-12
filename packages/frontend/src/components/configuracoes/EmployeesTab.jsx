import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import EmployeeModal from './EmployeeModal';
import EmployeesList from './EmployeesList';
import { fetchEmployees, createEmployee, updateEmployee, toggleEmployeeStatus, uploadEmployeeAvatar, deleteEmployee, resetEmployeePassword } from '../../services/employees.service';
import { useLoja } from '../../contexts/LojaContext';

export default function EmployeesTab() {
  const { lojaSelecionada, lojas } = useLoja();
  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ativos'); // ativos | inativos | todos

  useEffect(() => {
    loadEmployees(1);
  }, [lojaSelecionada]);

  const loadEmployees = async (page = pagination.page) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await fetchEmployees(page, 10, false, lojaSelecionada);
      setEmployees(result.data || []);
      setPagination(result.pagination);
    } catch (err) {
      setError('Erro ao carregar colaboradores');
      console.error('Load employees error:', err);
      toast.error('Erro ao carregar colaboradores');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (employeeData) => {
    try {
      let savedEmployee;
      if (editingEmployee) {
        savedEmployee = await updateEmployee(editingEmployee.id, employeeData);
        toast.success('Colaborador atualizado com sucesso!');
      } else {
        savedEmployee = await createEmployee(employeeData);
        toast.success('Colaborador criado com sucesso!');
      }
      // Retornar o employee salvo para o modal usar o ID
      return savedEmployee;
    } catch (err) {
      console.error('Save employee error:', err);
      throw err;
    }
  };

  // Função para fechar o modal após todas as operações
  const handleSaveComplete = async () => {
    await loadEmployees(pagination.page);
    setShowModal(false);
    setEditingEmployee(null);
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setShowModal(true);
  };

  const handleToggle = async (id) => {
    const employee = employees.find(emp => emp.id === id);
    const action = employee?.active ? 'desativar' : 'ativar';

    toast((t) => (
      <div>
        <p className="font-medium">Confirmar ação</p>
        <p className="text-sm text-gray-600 mt-1">
          Deseja {action} este colaborador?
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await toggleEmployeeStatus(id);
                await loadEmployees(pagination.page);
                toast.success(`Colaborador ${action === 'ativar' ? 'ativado' : 'desativado'} com sucesso!`);
              } catch (err) {
                console.error('Toggle employee error:', err);
                toast.error(`Erro ao ${action} colaborador`);
              }
            }}
            className="px-3 py-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded transition"
          >
            Confirmar
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    ), {
      duration: 5000,
      position: 'top-center',
    });
  };

  const handleUploadAvatar = async (id, file) => {
    try {
      await uploadEmployeeAvatar(id, file);
      await loadEmployees(pagination.page);
      toast.success('Avatar atualizado com sucesso!');
    } catch (err) {
      console.error('Upload avatar error:', err);
      toast.error('Erro ao fazer upload do avatar');
    }
  };

  const handleDelete = async (id, name) => {
    toast((t) => (
      <div>
        <p className="font-medium text-red-600">Excluir Colaborador</p>
        <p className="text-sm text-gray-600 mt-1">
          Tem certeza que deseja excluir <strong>{name}</strong>?
        </p>
        <p className="text-xs text-red-500 mt-1">
          Esta ação não pode ser desfeita!
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await deleteEmployee(id);
                await loadEmployees(pagination.page);
                toast.success('Colaborador excluído com sucesso!');
              } catch (err) {
                console.error('Delete employee error:', err);
                toast.error('Erro ao excluir colaborador');
              }
            }}
            className="px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded transition"
          >
            Excluir
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    ), {
      duration: 10000,
      position: 'top-center',
    });
  };

  const handleResetPassword = async (id, newPassword) => {
    try {
      await resetEmployeePassword(id, newPassword);
      toast.success('Senha alterada com sucesso!');
      return true;
    } catch (err) {
      console.error('Reset password error:', err);
      toast.error('Erro ao alterar senha');
      return false;
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setEditingEmployee(null);
  };

  const handleNewEmployee = () => {
    setEditingEmployee(null);
    setShowModal(true);
  };

  const handlePageChange = (newPage) => {
    loadEmployees(newPage);
  };

  if (isLoading && pagination.page === 1) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Carregando colaboradores...</p>
      </div>
    );
  }

  if (error && pagination.page === 1) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div>
      <Toaster />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h2 className="text-xl font-semibold">Gestão de Colaboradores</h2>
        {!showModal && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 sm:py-3 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="ativos">✅ Ativos</option>
              <option value="inativos">🚫 Inativos</option>
              <option value="todos">Todos</option>
            </select>
            <button
              onClick={handleNewEmployee}
              className="flex-1 sm:flex-none py-2 sm:py-3 px-3 sm:px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors whitespace-nowrap"
            >
              + Novo Colaborador
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <EmployeeModal
          employee={editingEmployee}
          onSave={handleSave}
          onCancel={handleCancel}
          onUploadAvatar={handleUploadAvatar}
          onSaveComplete={handleSaveComplete}
          onResetPassword={handleResetPassword}
          codLoja={lojaSelecionada}
        />
      )}

      <EmployeesList
        employees={employees.filter(e => statusFilter === 'todos' ? true : (statusFilter === 'ativos' ? e.active : !e.active))}
        onEdit={handleEdit}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onUploadAvatar={handleUploadAvatar}
        pagination={pagination}
        onPageChange={handlePageChange}
        isLoading={isLoading}
        lojas={lojas}
      />
    </div>
  );
}
