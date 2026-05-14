import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../config/database';

// Loga toda request autenticada (silenciosamente). Roda DEPOIS de authenticateToken.
export function accessLogMiddleware(req: Request, res: Response, next: NextFunction) {
  // Captura quando a resposta termina
  res.on('finish', () => {
    // Skip rotas de health check, swagger, e o proprio access-logs (evita loop)
    if (req.path.startsWith('/api/health') || req.path.startsWith('/api-docs') || req.path.startsWith('/api/access-logs')) return;

    const u = (req as any).user || {};
    const userId = u.id || (req as any).userId || null;
    const userType = u.type || (u.isMaster ? 'master' : u.role || null);
    const userName = u.username || u.name || null;

    // Sanitiza body — nao guarda senha/token
    let bodyMeta: any = null;
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      bodyMeta = { ...req.body };
      ['password', 'newPassword', 'currentPassword', 'token', 'masterPassword'].forEach(k => {
        if (bodyMeta[k]) bodyMeta[k] = '***';
      });
    }

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || null;

    AppDataSource.query(
      `INSERT INTO access_logs (user_id, user_type, user_name, method, path, status_code, ip, user_agent, body_meta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [userId, userType, userName, req.method, req.originalUrl || req.url, res.statusCode, ip, req.headers['user-agent'] || null, bodyMeta ? JSON.stringify(bodyMeta) : null]
    ).catch(err => console.warn('[access-log] erro ao gravar:', err.message));
  });

  next();
}
