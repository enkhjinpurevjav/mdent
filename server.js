// server.js (CommonJS) — production-ready
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const prisma = new PrismaClient();
app.use(express.json());

let isReady = false;       // readiness gate
let server;                // to close on shutdown

// ---- health endpoints ----
app.get('/live', (_req, res) => res.json({ status: 'alive' }));            // liveness
app.get('/ready', (_req, res) => {
  if (isReady) return res.json({ status: 'ok' });                           // readiness
  return res.status(503).json({ status: 'starting' });
});

// existing simple endpoints
app.get('/', (_req, res) => res.json({ name: 'M Dent API', status: 'ok' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' })); // keep for manual checks

// ---- your routes (unchanged) ----
app.get('/patients', async (req, res, next) => {
  try {
    const q = String(req.query.q || '');
    const where = q ? {
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName:  { contains: q, mode: 'insensitive' } },
        { phone:     { contains: q } },
        { email:     { contains: q, mode: 'insensitive' } },
      ],
    } : undefined;

    const rows = await prisma.patient.findMany({ where, take: 50, orderBy: { updatedAt: 'desc' } });
    res.json(rows);
  } catch (e) { next(e); }
});

app.post('/patients', async (req, res, next) => {
  try {
    const p = await prisma.patient.create({ data: req.body });
    res.status(201).json(p);
  } catch (e) { next(e); }
});

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

// central error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err && err.code === 'P2002') return res.status(409).json({ error: 'unique_constraint', meta: err.meta });
  if (err && err.code === 'P2003') return res.status(409).json({ error: 'foreign_key_constraint', meta: err.meta });
  if (err && err.name === 'PrismaClientValidationError') return res.status(400).json({ error: 'validation_error', message: err.message });
  return res.status(500).json({ error: 'internal_error' });
});

// ---- bootstrap with DB retries, then mark ready and listen ----
async function connectWithRetry({ tries = 10, delayMs = 1500 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      attempt += 1;
      await prisma.$queryRaw`SELECT 1`;  // lightweight ping
      console.log('[bootstrap] DB ping OK');
      return;
    } catch (e) {
      console.error(`[bootstrap] DB connect failed (attempt ${attempt}/${tries}):`, e.message);
      if (attempt >= tries) throw e;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function start() {
  await connectWithRetry();
  isReady = true;

  const PORT = process.env.PORT || 80;
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

// graceful shutdown
async function shutdown(signal) {
  console.log(`[shutdown] received ${signal}`);
  try {
    isReady = false;
    if (server) {
      await new Promise(resolve => server.close(resolve));
      console.log('[shutdown] http server closed');
    }
    await prisma.$disconnect();
    console.log('[shutdown] prisma disconnected');
  } catch (e) {
    console.error('[shutdown] error:', e);
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

start().catch(err => {
  console.error('[bootstrap] fatal:', err);
  process.exit(1);
});
