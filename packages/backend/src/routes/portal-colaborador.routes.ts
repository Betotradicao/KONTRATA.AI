import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { PortalColaboradorController } from '../controllers/portal-colaborador.controller';
import { authenticateColaborador } from '../middleware/auth';

// Portal do Colaborador — montado em /api/portal. Públicas primeiro (com limiter), depois
// tudo atrás do JWT de colaborador (NUNCA authenticateToken: token do painel não entra aqui).
const router: Router = Router();

const publicoLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', publicoLimiter, PortalColaboradorController.login);
router.get('/setup/:token', publicoLimiter, PortalColaboradorController.getSetup);
router.post('/setup/:token', publicoLimiter, PortalColaboradorController.postSetup);

router.use(authenticateColaborador);
router.get('/me', PortalColaboradorController.me);
router.get('/holerites', PortalColaboradorController.holerites);
router.get('/holerites/:id/pdf', PortalColaboradorController.pdf);
router.post('/holerites/:id/ciencia', PortalColaboradorController.ciencia);
router.post('/senha', PortalColaboradorController.trocarSenha);

export default router;
