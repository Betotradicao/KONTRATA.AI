export class EmployeeResponseDto {
  id: string;
  name: string;
  avatar: string | null;
  sector_id: number;
  sector?: {
    id: number;
    name: string;
    color_hash: string;
  };
  function_description: string;
  username: string;
  first_access: boolean;
  barcode: string;
  active: boolean;
  cod_loja: number | null;
  cod_lojas: number[];
  role_kontrata: string;
  is_conferente: boolean;
  is_cpd: boolean;
  is_financeiro: boolean;
  created_at: Date;
  updated_at: Date;

  constructor(employee: any) {
    this.id = employee.id;
    this.name = employee.name;
    this.avatar = employee.avatar;
    this.sector_id = employee.sector_id;
    this.function_description = employee.function_description;
    this.username = employee.username;
    this.first_access = employee.first_access;
    this.barcode = employee.barcode;
    this.active = employee.active;
    this.cod_loja = employee.cod_loja || null;
    this.cod_lojas = Array.isArray(employee.cod_lojas) && employee.cod_lojas.length
      ? employee.cod_lojas
      : (employee.cod_loja != null ? [employee.cod_loja] : []);
    this.role_kontrata = employee.role_kontrata || 'user';
    this.is_conferente = employee.is_conferente || false;
    this.is_cpd = employee.is_cpd || false;
    this.is_financeiro = employee.is_financeiro || false;
    this.created_at = employee.created_at;
    this.updated_at = employee.updated_at;

    // Include sector info if it was loaded
    if (employee.sector) {
      this.sector = {
        id: employee.sector.id,
        name: employee.sector.name,
        color_hash: employee.sector.color_hash,
      };
    }

    // IMPORTANT: Never include password in response
  }
}
