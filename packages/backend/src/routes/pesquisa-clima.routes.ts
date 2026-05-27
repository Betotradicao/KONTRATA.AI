import { Router, IRouter } from 'express';
import { PesquisaClimaController } from '../controllers/pesquisa-clima.controller';
import { authenticateToken } from '../middleware/auth';

const router: IRouter = Router();

// Publico (sem auth) - candidato/cliente acessa pelo token
router.get('/publico/:token', PesquisaClimaController.publicoCarregar);
router.post('/publico/:token/submeter', PesquisaClimaController.publicoSubmeter);

// Autenticado (RH)
router.use(authenticateToken);

// Modelos
router.get('/modelos', PesquisaClimaController.listarModelos);
router.get('/modelos/:id', PesquisaClimaController.getModelo);
router.post('/modelos', PesquisaClimaController.criarModelo);
router.put('/modelos/:id', PesquisaClimaController.atualizarModelo);
router.delete('/modelos/:id', PesquisaClimaController.deletarModelo);
router.put('/modelos/:id/perguntas', PesquisaClimaController.salvarPerguntas);
router.get('/modelos/:id/comparativo', PesquisaClimaController.comparativoEvolucao);
router.get('/nr1/diagnostico/:modeloId', PesquisaClimaController.diagnosticoNr1);

// NR-1 — Sugestoes e Planos de acao
import { Nr1Controller } from '../controllers/nr1.controller';
router.get('/nr1/sugestoes',        Nr1Controller.listarSugestoes);
router.post('/nr1/sugestoes',       Nr1Controller.criarSugestao);
router.get('/nr1/material/:tipo',   Nr1Controller.gerarMaterial);
router.get('/nr1/planos',           Nr1Controller.listarPlanos);
router.post('/nr1/planos',          Nr1Controller.criarPlano);
router.put('/nr1/planos/:id',       Nr1Controller.atualizarPlano);
router.delete('/nr1/planos/:id',    Nr1Controller.deletarPlano);

// Rodadas
router.get('/rodadas', PesquisaClimaController.listarRodadas);
router.post('/rodadas', PesquisaClimaController.criarRodada);
router.put('/rodadas/:id', PesquisaClimaController.atualizarRodada);
router.delete('/rodadas/:id', PesquisaClimaController.deletarRodada);
router.get('/rodadas/:id/dashboard', PesquisaClimaController.dashboardRodada);

export default router;
