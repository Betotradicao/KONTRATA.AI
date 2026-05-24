import { Router } from 'express';
import multer from 'multer';
import { RhController } from '../controllers/rh.controller';
import { RhDocumentacaoController } from '../controllers/rh-documentacao.controller';
import { RhAsoController } from '../controllers/rh-aso.controller';
import { RhDpController } from '../controllers/rh-dp.controller';
import { RhApontamentosController } from '../controllers/rh-apontamentos.controller';
import { RhEmpresasController } from '../controllers/rh-empresas.controller';
import { RhEscalaController } from '../controllers/rh-escala.controller';
import { RhFolhaController } from '../controllers/rh-folha.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();
const uploadDoc = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

router.get('/colaboradores', authenticateToken, RhController.listColaboradores);
router.get('/colaboradores/stats', authenticateToken, RhController.getStats);
router.get('/colaboradores/:id', authenticateToken, RhController.getColaboradorById);
router.post('/colaboradores', authenticateToken, RhController.createColaborador);
router.put('/colaboradores/:id', authenticateToken, RhController.updateColaborador);
router.delete('/colaboradores/:id', authenticateToken, RhController.deleteColaborador);

// Configuracoes - Cargos
router.get('/configuracoes/cargos', authenticateToken, RhController.listarCargos);
router.get('/configuracoes/cargos/sugestao-salarios', authenticateToken, RhController.sugestaoSalariosCargos);
router.post('/configuracoes/cargos', authenticateToken, RhController.criarCargo);
router.put('/configuracoes/cargos/:id', authenticateToken, RhController.atualizarCargo);
router.delete('/configuracoes/cargos/:id', authenticateToken, RhController.deletarCargo);

// Configuracoes - EPIs e EPCs
router.get('/configuracoes/epis-epcs', authenticateToken, RhController.listarEpisEpcs);
router.post('/configuracoes/epis-epcs', authenticateToken, RhController.criarEpiEpc);
router.put('/configuracoes/epis-epcs/:id', authenticateToken, RhController.atualizarEpiEpc);
router.delete('/configuracoes/epis-epcs/:id', authenticateToken, RhController.deletarEpiEpc);

// Empresas do RH (tabela propria rh_empresas, independente de companies)
router.get('/empresas', authenticateToken, RhEmpresasController.listar);
router.get('/empresas/stores/list', authenticateToken, RhEmpresasController.listarStores);
router.post('/empresas', authenticateToken, RhEmpresasController.criar);
router.put('/empresas/:id', authenticateToken, RhEmpresasController.atualizar);
router.delete('/empresas/:id', authenticateToken, RhEmpresasController.deletar);

// Configuracoes - Jornadas
router.get('/configuracoes/jornadas', authenticateToken, RhController.listarJornadas);
router.post('/configuracoes/jornadas', authenticateToken, RhController.criarJornada);
router.put('/configuracoes/jornadas/:id', authenticateToken, RhController.atualizarJornada);
router.delete('/configuracoes/jornadas/:id', authenticateToken, RhController.deletarJornada);

// Configuracoes - Escolaridades
router.get('/configuracoes/escolaridades', authenticateToken, RhController.listarEscolaridades);
router.post('/configuracoes/escolaridades', authenticateToken, RhController.criarEscolaridade);
router.put('/configuracoes/escolaridades/:id', authenticateToken, RhController.atualizarEscolaridade);
router.delete('/configuracoes/escolaridades/:id', authenticateToken, RhController.deletarEscolaridade);

// Configuracoes - Escalas
router.get('/configuracoes/escalas', authenticateToken, RhController.listarEscalas);
router.post('/configuracoes/escalas', authenticateToken, RhController.criarEscala);
router.put('/configuracoes/escalas/:id', authenticateToken, RhController.atualizarEscala);
router.delete('/configuracoes/escalas/:id', authenticateToken, RhController.deletarEscala);

// Escalas especiais de Domingo (1x1, 2x1, 3x1 etc)
router.get('/configuracoes/escalas-domingo', authenticateToken, RhController.listarEscalasDomingo);
router.post('/configuracoes/escalas-domingo', authenticateToken, RhController.criarEscalaDomingo);
router.put('/configuracoes/escalas-domingo/:id', authenticateToken, RhController.atualizarEscalaDomingo);
router.delete('/configuracoes/escalas-domingo/:id', authenticateToken, RhController.deletarEscalaDomingo);

// Configuracoes - Regimes de Trabalho
router.get('/configuracoes/regimes-trabalho', authenticateToken, RhController.listarRegimesTrabalho);
router.post('/configuracoes/regimes-trabalho', authenticateToken, RhController.criarRegimeTrabalho);
router.put('/configuracoes/regimes-trabalho/:id', authenticateToken, RhController.atualizarRegimeTrabalho);
router.delete('/configuracoes/regimes-trabalho/:id', authenticateToken, RhController.deletarRegimeTrabalho);

// Configuracoes - Formas de Pagamento
router.get('/configuracoes/formas-pagamento', authenticateToken, RhController.listarFormasPagamento);
router.post('/configuracoes/formas-pagamento', authenticateToken, RhController.criarFormaPagamento);
router.put('/configuracoes/formas-pagamento/:id', authenticateToken, RhController.atualizarFormaPagamento);
router.delete('/configuracoes/formas-pagamento/:id', authenticateToken, RhController.deletarFormaPagamento);

// Configuracoes - Prazos de Experiencia
router.get('/configuracoes/prazos-experiencia', authenticateToken, RhController.listarPrazosExperiencia);
router.post('/configuracoes/prazos-experiencia', authenticateToken, RhController.criarPrazoExperiencia);
router.put('/configuracoes/prazos-experiencia/:id', authenticateToken, RhController.atualizarPrazoExperiencia);
router.delete('/configuracoes/prazos-experiencia/:id', authenticateToken, RhController.deletarPrazoExperiencia);

// Configuracoes - Tipos de Desligamento
router.get('/configuracoes/tipos-desligamento', authenticateToken, RhController.listarTiposDesligamento);
router.post('/configuracoes/tipos-desligamento', authenticateToken, RhController.criarTipoDesligamento);
router.put('/configuracoes/tipos-desligamento/:id', authenticateToken, RhController.atualizarTipoDesligamento);
router.delete('/configuracoes/tipos-desligamento/:id', authenticateToken, RhController.deletarTipoDesligamento);

// Configuracoes - Motivos de Desligamento
router.get('/configuracoes/motivos-desligamento', authenticateToken, RhController.listarMotivosDesligamento);
router.post('/configuracoes/motivos-desligamento', authenticateToken, RhController.criarMotivoDesligamento);
router.put('/configuracoes/motivos-desligamento/:id', authenticateToken, RhController.atualizarMotivoDesligamento);
router.delete('/configuracoes/motivos-desligamento/:id', authenticateToken, RhController.deletarMotivoDesligamento);

// Configuracoes - Beneficios
router.get('/configuracoes/beneficios', authenticateToken, RhController.listarBeneficios);
router.post('/configuracoes/beneficios', authenticateToken, RhController.criarBeneficio);
router.put('/configuracoes/beneficios/:id', authenticateToken, RhController.atualizarBeneficio);
router.delete('/configuracoes/beneficios/:id', authenticateToken, RhController.deletarBeneficio);

// Configuracoes - Departamentos
router.get('/configuracoes/departamentos', authenticateToken, RhController.listarDepartamentos);
router.post('/configuracoes/departamentos', authenticateToken, RhController.criarDepartamento);
router.put('/configuracoes/departamentos/:id', authenticateToken, RhController.atualizarDepartamento);
router.delete('/configuracoes/departamentos/:id', authenticateToken, RhController.deletarDepartamento);

// Configuracoes - Tipos de Ausencia
router.get('/configuracoes/tipos-ausencia', authenticateToken, RhController.listarTiposAusencia);
router.post('/configuracoes/tipos-ausencia', authenticateToken, RhController.criarTipoAusencia);
router.put('/configuracoes/tipos-ausencia/:id', authenticateToken, RhController.atualizarTipoAusencia);
router.delete('/configuracoes/tipos-ausencia/:id', authenticateToken, RhController.deletarTipoAusencia);

// Configuracoes - Motivos de Ausencia
router.get('/configuracoes/motivos-ausencia', authenticateToken, RhController.listarMotivosAusencia);
router.post('/configuracoes/motivos-ausencia', authenticateToken, RhController.criarMotivoAusencia);
router.put('/configuracoes/motivos-ausencia/:id', authenticateToken, RhController.atualizarMotivoAusencia);
router.delete('/configuracoes/motivos-ausencia/:id', authenticateToken, RhController.deletarMotivoAusencia);

// Configuracoes - Tipos de Treinamento
router.get('/configuracoes/tipos-treinamento', authenticateToken, RhController.listarTiposTreinamento);
router.post('/configuracoes/tipos-treinamento', authenticateToken, RhController.criarTipoTreinamento);
router.put('/configuracoes/tipos-treinamento/:id', authenticateToken, RhController.atualizarTipoTreinamento);
router.delete('/configuracoes/tipos-treinamento/:id', authenticateToken, RhController.deletarTipoTreinamento);

// Configuracoes - Status de Treinamento
router.get('/configuracoes/status-treinamento', authenticateToken, RhController.listarStatusTreinamento);
router.post('/configuracoes/status-treinamento', authenticateToken, RhController.criarStatusTreinamento);
router.put('/configuracoes/status-treinamento/:id', authenticateToken, RhController.atualizarStatusTreinamento);
router.delete('/configuracoes/status-treinamento/:id', authenticateToken, RhController.deletarStatusTreinamento);

// ASO
router.get('/aso', authenticateToken, RhController.listarAso);
router.post('/aso', authenticateToken, RhController.criarAso);
router.put('/aso/:id', authenticateToken, RhController.atualizarAso);
router.delete('/aso/:id', authenticateToken, RhController.deletarAso);

// Ausencias
router.get('/ausencias', authenticateToken, RhController.listarAusencias);
router.post('/ausencias', authenticateToken, RhController.criarAusencia);
router.put('/ausencias/:id', authenticateToken, RhController.atualizarAusencia);
router.delete('/ausencias/:id', authenticateToken, RhController.deletarAusencia);

// Treinamentos
router.get('/treinamentos', authenticateToken, RhController.listarTreinamentos);
router.post('/treinamentos', authenticateToken, RhController.criarTreinamento);
router.put('/treinamentos/:id', authenticateToken, RhController.atualizarTreinamento);
router.delete('/treinamentos/:id', authenticateToken, RhController.deletarTreinamento);

// Vagas (Recrutamento)
router.get('/vagas', authenticateToken, RhController.listarVagas);
router.post('/vagas', authenticateToken, RhController.criarVaga);
router.put('/vagas/:id', authenticateToken, RhController.atualizarVaga);
router.delete('/vagas/:id', authenticateToken, RhController.deletarVaga);

// Candidatos
router.get('/candidatos', authenticateToken, RhController.listarCandidatos);
router.post('/candidatos', authenticateToken, RhController.criarCandidato);
router.put('/candidatos/:id', authenticateToken, RhController.atualizarCandidato);
router.delete('/candidatos/:id', authenticateToken, RhController.deletarCandidato);

// Lancamentos Financeiros (Folha)
router.get('/lancamentos-financeiros', authenticateToken, RhController.listarLancamentosFinanceiros);
router.post('/lancamentos-financeiros', authenticateToken, RhController.criarLancamentoFinanceiro);
router.put('/lancamentos-financeiros/:id', authenticateToken, RhController.atualizarLancamentoFinanceiro);
router.delete('/lancamentos-financeiros/:id', authenticateToken, RhController.deletarLancamentoFinanceiro);

// Dependentes
router.get('/dependentes', authenticateToken, RhController.listarDependentes);
router.post('/dependentes', authenticateToken, RhController.criarDependente);
router.put('/dependentes/:id', authenticateToken, RhController.atualizarDependente);
router.delete('/dependentes/:id', authenticateToken, RhController.deletarDependente);

// Historico de Alteracoes
router.get('/historico-alteracoes', authenticateToken, RhController.listarHistoricoAlteracoes);
router.post('/historico-alteracoes', authenticateToken, RhController.criarHistoricoAlteracao);
router.put('/historico-alteracoes/:id', authenticateToken, RhController.atualizarHistoricoAlteracao);
router.delete('/historico-alteracoes/:id', authenticateToken, RhController.deletarHistoricoAlteracao);

// DISC
// Endpoint PUBLICO do DISC (sem auth) — candidato/colaborador preenche via link direto
router.post('/disc-publico/submit', RhController.salvarDiscResultadoPublico);

router.get('/disc-results', authenticateToken, RhController.listarDiscResultados);
router.get('/disc-results/:id', authenticateToken, RhController.getDiscResultado);
router.post('/disc-results', authenticateToken, RhController.salvarDiscResultado);
router.delete('/disc-results/:id', authenticateToken, RhController.deletarDiscResultado);

// Documentacao - Stats
router.get('/documentacao/stats', authenticateToken, RhDocumentacaoController.obterStats);
router.get('/documentacao/stats-por-colaborador', authenticateToken, RhDocumentacaoController.obterStatsPorColaborador);
router.get('/documentacao/tree-colaborador', authenticateToken, RhDocumentacaoController.obterTreeColaborador);

// Documentacao - Pastas
router.get('/documentacao/pastas', authenticateToken, RhDocumentacaoController.listarPastas);
router.post('/documentacao/pastas', authenticateToken, RhDocumentacaoController.criarPasta);
router.post('/documentacao/pastas/reordenar', authenticateToken, RhDocumentacaoController.reordenarPastas);
router.post('/documentacao/pastas/:id/replicar-todos', authenticateToken, RhDocumentacaoController.replicarPastaParaTodos);
router.get('/documentacao/pastas/:id/pdf', authenticateToken, RhDocumentacaoController.gerarPdfDaPasta);
router.put('/documentacao/pastas/:id', authenticateToken, RhDocumentacaoController.atualizarPasta);
router.delete('/documentacao/pastas/:id', authenticateToken, RhDocumentacaoController.deletarPasta);

// Apontamentos (Lancamentos Financeiros)
router.get('/apontamentos', authenticateToken, RhApontamentosController.listar);
router.get('/apontamentos/periodos', authenticateToken, RhApontamentosController.listarPeriodos);

// Folha de Pagamento - resumo anual (pivot mes x lancamento)
router.get('/folha/resumo-anual', authenticateToken, RhFolhaController.resumoAnual);
router.get('/folha/holerite', authenticateToken, RhFolhaController.holerite);
router.post('/apontamentos/periodos/deletar', authenticateToken, RhApontamentosController.deletarPeriodo);
router.post('/apontamentos/batch', authenticateToken, RhApontamentosController.salvarLote);
router.get('/apontamentos/pdf', authenticateToken, RhApontamentosController.exportarPdf);
router.get('/apontamentos/excel', authenticateToken, RhApontamentosController.exportarExcel);
router.get('/apontamentos/campos', authenticateToken, RhApontamentosController.listarCampos);
router.post('/apontamentos/campos', authenticateToken, RhApontamentosController.criarCampo);
router.delete('/apontamentos/campos/:id', authenticateToken, RhApontamentosController.deletarCampo);

// Departamento Pessoal (docs da empresa)
router.get('/dp/pastas', authenticateToken, RhDpController.listarPastas);
router.post('/dp/pastas', authenticateToken, RhDpController.criarPasta);
router.post('/dp/pastas/reordenar', authenticateToken, RhDpController.reordenarPastas);
router.post('/dp/seed/:companyId', authenticateToken, RhDpController.seedPadraoPorEmpresa);
router.put('/dp/pastas/:id', authenticateToken, RhDpController.atualizarPasta);
router.post('/dp/pastas/:id/validar-senha', authenticateToken, RhDpController.validarSenhaPasta);
router.delete('/dp/pastas/:id', authenticateToken, RhDpController.deletarPasta);
router.get('/dp/subpastas', authenticateToken, RhDpController.listarSubpastas);
router.post('/dp/subpastas', authenticateToken, RhDpController.criarSubpasta);
router.put('/dp/subpastas/:id', authenticateToken, RhDpController.atualizarSubpasta);
router.delete('/dp/subpastas/:id', authenticateToken, RhDpController.deletarSubpasta);
router.get('/dp/documentos', authenticateToken, RhDpController.listarDocumentos);
router.post('/dp/documentos', authenticateToken, uploadDoc.single('arquivo'), RhDpController.uploadDocumento);
router.put('/dp/documentos/:id/datas', authenticateToken, RhDpController.atualizarDatasDocumento);
router.delete('/dp/documentos/:id', authenticateToken, RhDpController.deletarDocumento);

// Documentacao - Subpastas (itens de documento por pasta)
router.get('/documentacao/subpastas', authenticateToken, RhDocumentacaoController.listarSubpastas);
router.post('/documentacao/subpastas', authenticateToken, RhDocumentacaoController.criarSubpasta);
router.put('/documentacao/subpastas/:id', authenticateToken, RhDocumentacaoController.atualizarSubpasta);
router.delete('/documentacao/subpastas/:id', authenticateToken, RhDocumentacaoController.deletarSubpasta);

// ASO (Saude Ocupacional)
router.get('/asos', authenticateToken, RhAsoController.listar);
router.get('/asos/stats', authenticateToken, RhAsoController.stats);
router.get('/asos/colaboradores', authenticateToken, RhAsoController.listarColaboradoresComStatus);
router.post('/asos', authenticateToken, RhAsoController.criar);
router.put('/asos/:id', authenticateToken, RhAsoController.atualizar);
router.post('/asos/:id/arquivo', authenticateToken, uploadDoc.single('arquivo'), RhAsoController.uploadArquivo);
router.delete('/asos/:id', authenticateToken, RhAsoController.deletar);

// Documentacao - Arquivos
router.get('/documentacao/documentos', authenticateToken, RhDocumentacaoController.listarDocumentos);
router.post('/documentacao/documentos', authenticateToken, uploadDoc.single('arquivo'), RhDocumentacaoController.uploadDocumento);
router.delete('/documentacao/documentos/:id', authenticateToken, RhDocumentacaoController.deletarDocumento);

// ============ Escala de Trabalho ============
// Catalogo de turnos
router.get('/escala/turnos', authenticateToken, RhEscalaController.listarTurnos);
router.post('/escala/turnos', authenticateToken, RhEscalaController.criarTurno);
router.put('/escala/turnos/:id', authenticateToken, RhEscalaController.atualizarTurno);
router.delete('/escala/turnos/:id', authenticateToken, RhEscalaController.deletarTurno);

// Cobertura minima
router.get('/escala/cobertura', authenticateToken, RhEscalaController.listarCobertura);
router.post('/escala/cobertura', authenticateToken, RhEscalaController.salvarCobertura);

// Templates por colaborador
router.get('/escala/templates/:colaboradorId', authenticateToken, RhEscalaController.obterTemplate);
router.put('/escala/templates/:colaboradorId', authenticateToken, RhEscalaController.salvarTemplate);

// Grid mensal
router.get('/escala/grid', authenticateToken, RhEscalaController.obterGrid);
router.post('/escala/celula', authenticateToken, RhEscalaController.salvarCelulaManual);
router.delete('/escala/celula', authenticateToken, RhEscalaController.limparCelulaManual);

// Eventos
router.get('/escala/ferias', authenticateToken, RhEscalaController.listarFerias);
router.post('/escala/ferias', authenticateToken, RhEscalaController.criarFerias);
router.delete('/escala/ferias/:id', authenticateToken, RhEscalaController.deletarFerias);

router.get('/escala/licencas', authenticateToken, RhEscalaController.listarLicencas);
router.post('/escala/licencas', authenticateToken, RhEscalaController.criarLicenca);
router.delete('/escala/licencas/:id', authenticateToken, RhEscalaController.deletarLicenca);

router.get('/escala/excessoes', authenticateToken, RhEscalaController.listarExcessoes);
router.post('/escala/excessoes', authenticateToken, RhEscalaController.criarExcessao);
router.delete('/escala/excessoes/:id', authenticateToken, RhEscalaController.deletarExcessao);

export default router;
