import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { PortalColaboradorController } from '../controllers/portal-colaborador.controller';
import { authenticateColaborador, AuthRequest } from '../middleware/auth';
import { PortalColaboradorService } from '../services/portal-colaborador.service';

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
// Token vale 7 dias, mas bloqueio/desligamento tem que valer na hora: confere a cada requisição
router.use(async (req: AuthRequest, res, next) => {
  try {
    const pode = await PortalColaboradorService.podeAcessar(Number(req.user!.id));
    if (!pode.ok) return res.status(401).json({ error: pode.motivo });
    next();
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get('/me', PortalColaboradorController.me);
router.get('/holerites', PortalColaboradorController.holerites);
router.get('/holerites/:id/pdf', PortalColaboradorController.pdf);
router.post('/holerites/:id/codigo', PortalColaboradorController.pedirCodigo);
router.post('/holerites/:id/codigo/validar', PortalColaboradorController.validarCodigo);
router.post('/holerites/:id/ciencia', PortalColaboradorController.ciencia);
router.post('/senha', PortalColaboradorController.trocarSenha);

export default router;
