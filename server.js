require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 80;

app.use(express.json());
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('tiny'));
app.use(rateLimit({ windowMs: 60_000, max: 120 })); // 120 req/min/IP

// Health / Ready
app.get('/', (_req, res) => res.json({ name: 'M Dent API', status: 'ok' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/ready', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'ready' }); }
  catch { res.status(503).json({ status: 'db_down' }); }
});

// JWT helpers
function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, branchId: user.branchId || null }, process.env.JWT_SECRET, { expiresIn: '12h' });
}
function auth(requiredRoles = []) {
  return (req, res, next) => {
    try {
      const hdr = req.headers.authorization || '';
      const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
      if (!token) return res.status(401).json({ error: 'unauthorized' });
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload;
      if (requiredRoles.length && !requiredRoles.includes(payload.role)) return res.status(403).json({ error: 'forbidden' });
      next();
    } catch { return res.status(401).json({ error: 'unauthorized' }); }
  };
}

// Auth
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
  const token = signToken(user);
  res.json({ token });
});
app.get('/me', auth(), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { id: true, email: true, role: true, name: true, branchId: true } });
  res.json(user);
});

// One-time GUI seed (disable after use)
// Call: POST /seed/once with {secret:"<any value you set below>"}
const SEED_SECRET = process.env.SEED_SECRET || 'disable_me';
let seedDone = false;
app.post('/seed/once', async (req, res) => {
  if (seedDone || SEED_SECRET === 'disable_me') return res.status(404).end();
  if (!req.body || req.body.secret !== SEED_SECRET) return res.status(403).end();
  const hash = await bcrypt.hash('changeme123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@mdent.cloud' },
    update: { password: hash, role: 'ADMIN', name: 'Admin' },
    create: { email: 'admin@mdent.cloud', password: hash, role: 'ADMIN', name: 'Admin' }
  });
  seedDone = true;
  res.json({ ok: true });
});

// Patients (simple CRUD + search)
const { z } = require('zod');
const patientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(3).optional().nullable(),
  email: z.string().email().optional().nullable(),
  regNo: z.string().min(5).optional().nullable(),
  birthDate: z.string().optional().nullable(), // ISO date
  gender: z.string().optional().nullable(),
  branchId: z.string().optional().nullable()
});

app.get('/patients', auth(), async (req, res, next) => {
  try {
    const q = String(req.query.q || '');
    const where = q ? {
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName:  { contains: q, mode: 'insensitive' } },
        { phone:     { contains: q } },
        { email:     { contains: q, mode: 'insensitive' } },
        { regNo:     { contains: q, mode: 'insensitive' } },
      ]
    } : undefined;
    const rows = await prisma.patient.findMany({ where, take: 50, orderBy: { updatedAt: 'desc' } });
    res.json(rows);
  } catch (e) { next(e); }
});

app.post('/patients', auth(), async (req, res, next) => {
  try {
    const data = patientSchema.parse(req.body);
    const p = await prisma.patient.create({ data });
    res.status(201).json(p);
  } catch (e) { next(e); }
});

app.get('/patients/:id', auth(), async (req, res, next) => {
  try {
    const p = await prisma.patient.findUnique({ where: { id: req.params.id } });
    if (!p) return res.status(404).end();
    res.json(p);
  } catch (e) { next(e); }
});

app.patch('/patients/:id', auth(), async (req, res, next) => {
  try {
    const data = patientSchema.partial().parse(req.body);
    const p = await prisma.patient.update({ where: { id: req.params.id }, data });
    res.json(p);
  } catch (e) { next(e); }
});

app.delete('/patients/:id', auth(['ADMIN','FRONTDESK']), async (req, res, next) => {
  try { await prisma.patient.delete({ where: { id: req.params.id } }); res.status(204).end(); }
  catch (e) { next(e); }
});

// 404
app.use((req, res) => res.status(404).json({ error: 'not_found' }));

// Errors
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.code === 'P2002') return res.status(409).json({ error: 'unique_constraint', meta: err.meta });
  if (err?.code === 'P2003') return res.status(409).json({ error: 'foreign_key_constraint', meta: err.meta });
  if (err?.name === 'PrismaClientValidationError') return res.status(400).json({ error: 'validation_error', message: err.message });
  if (err?.name === 'ZodError') return res.status(400).json({ error: 'validation_error', issues: err.issues });
  return res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${PORT}`));
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGINT',  async () => { await prisma.$disconnect(); process.exit(0); });
