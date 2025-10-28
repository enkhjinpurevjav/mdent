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

// ✅ Ready
app.get('/ready', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'ready' }); }
  catch { res.status(503).json({ status: 'db_down' }); }
});

// ...patients, auth, etc...

// 404 after all routes
app.use((req, res) => res.status(404).json({ error: 'not_found' }));

// Error handler last
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.code === 'P2002') return res.status(409).json({ error: 'unique_constraint', meta: err.meta });
  if (err?.code === 'P2003') return res.status(409).json({ error: 'foreign_key_constraint', meta: err.meta });
  if (err?.name === 'PrismaClientValidationError') return res.status(400).json({ error: 'validation_error', message: err.message });
  return res.status(500).json({ error: 'internal_error' });
});

const PORT = process.env.PORT || 80;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${PORT}`));
