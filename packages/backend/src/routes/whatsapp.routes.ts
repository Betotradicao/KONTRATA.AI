import { Router } from 'express';
import { WhatsappController } from '../controllers/whatsapp.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

// GET /api/whatsapp/connection-status — testa conexao com a Evolution API
router.get('/connection-status', authenticateToken, WhatsappController.connectionStatus);

// GET /api/whatsapp/fetch-groups — lista os grupos da instancia
router.get('/fetch-groups', authenticateToken, WhatsappController.fetchGroups);

// POST /api/whatsapp/test-group — envia mensagem de teste
router.post('/test-group', authenticateToken, WhatsappController.testGroup);

// Vagas em Aberto (envio semanal pro grupo)
router.post('/vagas-abertas/enviar', authenticateToken, WhatsappController.enviarVagasAbertas);
router.get('/vagas-abertas/preview', authenticateToken, WhatsappController.previewVagasAbertas);

// Saúde Ocupacional / ASO (envio semanal pro grupo: vencidos + a vencer)
router.post('/aso/enviar', authenticateToken, WhatsappController.enviarAso);
router.get('/aso/preview', authenticateToken, WhatsappController.previewAso);

// Denúncia NR-1 (notificação automática ao receber denúncia; teste manual)
router.post('/denuncia-nr1/enviar', authenticateToken, WhatsappController.enviarDenunciaNr1);
router.get('/denuncia-nr1/preview', authenticateToken, WhatsappController.previewDenunciaNr1);

// Documentos / Departamento Pessoal (vencimento + obrigatórios faltando)
router.post('/dp-docs/enviar', authenticateToken, WhatsappController.enviarDpDocs);
router.get('/dp-docs/preview', authenticateToken, WhatsappController.previewDpDocs);

// Aniversariantes (parabéns diário no grupo)
router.post('/aniversario/enviar', authenticateToken, WhatsappController.enviarAniversario);
router.get('/aniversario/preview', authenticateToken, WhatsappController.previewAniversario);

export default router;
