import { Router } from 'express';
import { AtendenteVirtualController } from '../controllers/atendente-virtual.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

// PÚBLICO — a Evolution chama sem token. Precisa vir ANTES do authenticateToken.
router.post('/webhook', AtendenteVirtualController.webhook);

router.use(authenticateToken);

router.get('/config', AtendenteVirtualController.obter);
router.put('/config', AtendenteVirtualController.salvar);
router.post('/configurar-webhook', AtendenteVirtualController.configurarWebhook);
router.get('/sessoes', AtendenteVirtualController.sessoes);
router.post('/sessoes/:telefone/devolver-ao-bot', AtendenteVirtualController.devolverAoBot);

export default router;
