import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('rh_colaboradores')
export class RhColaborador {
  @PrimaryGeneratedColumn()
  id: number;

  // --- Dados Pessoais ---
  @Column({ type: 'varchar', length: 255 })
  nome: string;

  @Column({ type: 'varchar', length: 14, unique: true })
  cpf: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  rg: string | null;

  @Column({ type: 'date', nullable: true })
  data_nascimento: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  sexo: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  estado_civil: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  nacionalidade: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  naturalidade: string | null;

  // --- Contato ---
  @Column({ type: 'varchar', length: 20, nullable: true })
  telefone: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  celular: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email_pessoal: string | null;

  // --- Endereco ---
  @Column({ type: 'varchar', length: 10, nullable: true })
  cep: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  endereco: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  numero: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  complemento: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bairro: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cidade: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  estado: string | null;

  // --- Dados Profissionais ---
  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  matricula: string | null;

  @Column({ type: 'int', nullable: true })
  cargo_id: number | null;

  @Column({ type: 'int', nullable: true })
  empresa_id: number | null;

  @Column({ type: 'int', nullable: true })
  jornada_id: number | null;

  @Column({ type: 'int', nullable: true })
  escolaridade_id: number | null;

  @Column({ type: 'int', nullable: true })
  regime_trabalho_id: number | null;

  @Column({ type: 'date', nullable: true })
  data_admissao: Date | null;

  @Column({ type: 'date', nullable: true })
  data_desligamento: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  salario: number | null;

  @Column({ type: 'varchar', length: 20, default: 'ativo' })
  status: string;

  // --- Beneficios ---
  @Column({ type: 'boolean', default: false })
  vale_transporte: boolean;

  @Column({ type: 'boolean', default: false })
  vale_refeicao: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  valor_vale_refeicao: number | null;

  @Column({ type: 'boolean', default: false })
  plano_saude: boolean;

  // --- Dados Bancarios ---
  @Column({ type: 'varchar', length: 50, nullable: true })
  banco: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  agencia: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  conta: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  tipo_conta: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  pix: string | null;

  // --- Documentos ---
  @Column({ type: 'varchar', length: 20, nullable: true })
  ctps: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  serie_ctps: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  pis_pasep: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  titulo_eleitor: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  reservista: string | null;

  // --- Filiacao ---
  @Column({ type: 'varchar', length: 255, nullable: true })
  nome_mae: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nome_pai: string | null;

  // --- Controle ---
  @Column({ type: 'text', nullable: true })
  observacoes: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  filtro1: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  filtro2: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  filtro3: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  foto_url: string | null;

  // --- Desligamento ---
  @Column({ type: 'int', nullable: true })
  tipo_desligamento_id: number | null;

  @Column({ type: 'int', nullable: true })
  motivo_desligamento_id: number | null;

  @Column({ type: 'text', nullable: true })
  observacoes_desligamento: string | null;

  // Quando true, o colaborador eh dispensado de ASO obrigatorio (aprendiz/estagio).
  // Nao entra em "Sem ASO" nem dispara alerta de vencimento.
  @Column({ name: 'aso_dispensado', type: 'boolean', default: false })
  aso_dispensado: boolean;

  // --- Auditoria ---
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
