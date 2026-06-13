import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type CurriculoStatus = 'novo' | 'em_analise' | 'aprovado' | 'reprovado' | 'contratado';

@Entity('curriculos')
export class Curriculo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  nome: string;

  @Column({ type: 'date', nullable: true })
  data_nascimento: Date | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  whatsapp: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  instagram: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  linkedin: string | null;

  @Column({ type: 'varchar', length: 9, nullable: true })
  cep: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  rua: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  numero: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  complemento: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bairro: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cidade: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  estado: string | null;

  // Coords geocodadas a partir do CEP (pra distancia residencia->loja). geo_cep
  // = cep que gerou as coords (re-geocoda se mudar). Ver GeocodeService.
  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  @Column({ type: 'varchar', length: 9, nullable: true })
  geo_cep: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  geo_updated_at: Date | null;

  // Guarda array de strings (nome do cargo) marcados pelo candidato
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  cargos: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  habilidades: string[];

  @Column({ type: 'text', nullable: true })
  foto_url: string | null;

  @Column({ type: 'text', nullable: true })
  resumo: string | null;

  // Tipo de vaga que o candidato quer (slug em curriculo_tipos_vaga)
  // Obrigatorio ao enviar. Padroes: 'clt', 'aprendiz' — admin pode criar mais
  @Column({ type: 'varchar', length: 50, nullable: true })
  interesse_vaga: string | null;

  // Array de objetos: { funcao, empresa, empresa_instagram, tempo_anos, tempo_meses, descricao }
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  experiencias_detalhadas: Array<{
    funcao: string;
    empresa?: string;
    empresa_instagram?: string;
    tempo_anos?: number;
    tempo_meses?: number;
    descricao?: string;
  }>;

  // Formacao academica: nivel + nome do curso + situacao
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  formacoes: Array<{
    curso: string; // Nivel (Ensino Medio, Superior, etc)
    nome_curso?: string; // Nome especifico do curso
    status?: string; // concluido | cursando | incompleto
  }>;

  // Cursos complementares: objetos com nome, instituicao e tempo/carga horaria
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  cursos_adicionais: Array<{
    nome: string;
    instituicao?: string;
    tempo?: string; // ex: "40h", "3 meses", "1 ano"
  }>;

  @Column({ type: 'text', nullable: true })
  experiencia_texto: string | null;

  // Disponibilidade de turnos (array de strings): manha, intermediario, tarde, qualquer
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  disponibilidade_turnos: string[];

  @Column({ type: 'text', nullable: true })
  observacao_rh: string | null;

  @Column({ type: 'varchar', length: 30, default: 'novo' })
  status: CurriculoStatus;

  @Column({ type: 'int', nullable: true })
  avaliacao_rh: number | null;

  @Column({ type: 'int', nullable: true })
  cod_loja: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
