require('dotenv').config();

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const prisma = new PrismaClient();
app.use(express.json());

// Health
app.get('/', (_req, res) => res.json({ name: 'M Dent API', status: 'ok' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Ready (DB ping)
app.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'db_down' });
  }
});

// Patients
app.get('/patients', async (req, res, next) => {
  try {
    const q = String(req.query.q || '');
    const where = q
      ? {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName:  { contains: q, mode: 'insensitive' } },
            { phone:     { contains: q } },
            { email:     { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined;

    const rows = await prisma.patient.findMany({
      where, take: 50, orderBy: { updatedAt: 'desc' }
    });
    res.json(rows);
  } catch (e) { next(e); }
});

app.post('/patients', async (req, res, next) => {
  try {
    const p = await prisma.patient.create({ data: req.body });
    res.status(201).json(p);
  } catch (e) { next(e); }
});

// Auth
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

  if (!process.env.JWT_SECRET) return res.status(500).json({ error: 'missing_jwt_secret' });

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

// 404 AFTER all routes
app.use((req, res) => res.status(404).json({ error: 'not_found' }));

// Error handler LAST
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.code === 'P2002') return res.status(409).json({ error: 'unique_constraint', meta: err.meta });
  if (err?.code === 'P2003') return res.status(409).json({ error: 'foreign_key_constraint', meta: err.meta });
  if (err?.name === 'PrismaClientValidationError') return res.status(400).json({ error: 'validation_error', message: err.message });
  return res.status(500).json({ error: 'internal_error' });
});

const PORT = process.env.PORT || 80;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGINT',  async () => { await prisma.$disconnect(); process.exit(0); });
