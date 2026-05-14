import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { AppDataSource } from '../config/database';

const router: Router = Router();

// GET /api/access-logs?page=1&limit=50&data_inicio=...&data_fim=...&user=...&metodo=...
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = (page - 1) * limit;

    const conds: string[] = [];
    const params: any[] = [];
    let p = 1;
    if (req.query.data_inicio) { conds.push(`created_at >= $${p++}`); params.push(req.query.data_inicio + ' 00:00:00'); }
    if (req.query.data_fim) { conds.push(`created_at <= $${p++}`); params.push(req.query.data_fim + ' 23:59:59'); }
    if (req.query.user) { conds.push(`(user_name ILIKE $${p} OR user_id::text = $${p})`); params.push(`%${req.query.user}%`); p++; }
    if (req.query.metodo) {
      const metodos = String(req.query.metodo).split(',');
      conds.push(`method = ANY($${p++})`); params.push(metodos);
    }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

    const totalRes = await AppDataSource.query(`SELECT COUNT(*)::int as total FROM access_logs ${where}`, params);
    const total = totalRes[0]?.total || 0;

    const data = await AppDataSource.query(
      `SELECT al.id, al.user_id, al.user_type,
              COALESCE(NULLIF(al.user_name, ''), u.name, u.username, e.name, e.username) as user_name,
              al.method, al.path, al.status_code, al.ip, al.created_at
       FROM access_logs al
       LEFT JOIN users u ON u.id = al.user_id
       LEFT JOIN employees e ON e.id = al.user_id
       ${where ? where.replace(/created_at/g, 'al.created_at').replace(/user_name/g, 'al.user_name').replace(/user_id/g, 'al.user_id').replace(/method/g, 'al.method') : ''}
       ORDER BY al.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    res.json({ data, total, page, limit });
  } catch (err: any) {
    console.error('access-logs GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/access-logs/export?... → CSV
router.get('/export', authenticateToken, async (req: Request, res: Response) => {
  try {
    const conds: string[] = [];
    const params: any[] = [];
    let p = 1;
    if (req.query.data_inicio) { conds.push(`created_at >= $${p++}`); params.push(req.query.data_inicio + ' 00:00:00'); }
    if (req.query.data_fim) { conds.push(`created_at <= $${p++}`); params.push(req.query.data_fim + ' 23:59:59'); }
    if (req.query.user) { conds.push(`(user_name ILIKE $${p} OR user_id::text = $${p})`); params.push(`%${req.query.user}%`); p++; }
    if (req.query.metodo) {
      const metodos = String(req.query.metodo).split(',');
      conds.push(`method = ANY($${p++})`); params.push(metodos);
    }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

    const rows = await AppDataSource.query(
      `SELECT created_at, user_name, user_type, method, path, status_code, ip, user_agent FROM access_logs ${where} ORDER BY created_at DESC LIMIT 50000`,
      params
    );

    const header = 'data_hora,usuario,tipo,metodo,recurso,status,ip,user_agent\n';
    const body = rows.map((r: any) => {
      const esc = (s: any) => `"${String(s ?? '').replace(/"/g, '""')}"`;
      return [r.created_at?.toISOString?.() || r.created_at, esc(r.user_name), r.user_type, r.method, esc(r.path), r.status_code, r.ip, esc(r.user_agent)].join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="access_logs_${new Date().toISOString().slice(0,10)}.csv"`);
    res.send('﻿' + header + body);
  } catch (err: any) {
    console.error('access-logs export error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
