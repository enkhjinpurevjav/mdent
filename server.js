

// server.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// health + root
app.get('/', (_req, res) => res.json({ name: 'M Dent API', status: 'ok' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Patients
app.get('/patients', async (req, res) => {
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
});

app.post('/patients', async (req, res) => {
  const p = await prisma.patient.create({ data: req.body });
  res.status(201).json(p);
});

// Appointments
app.get('/appointments', async (req, res) => {
  const day = req.query.day ? new Date(String(req.query.day)) : null;
  const where = day ? {
    startsAt: { gte: new Date(day.setHours(0,0,0,0)), lt: new Date(day.setHours(24,0,0,0)) }
  } : undefined;
  const rows = await prisma.appointment.findMany({ where, include: { patient: true }, orderBy: { startsAt: 'asc' }, take: 200 });
  res.json(rows);
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => console.log(`API listening on ${PORT}`));

// at top with other requires
const jwt = require('jsonwebtoken');

// ... keep your existing code (express, prisma, app.use(express.json()), routes)

// --- AUTH ---
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });

  // TEMP: passwords are plain from seed; switch to bcrypt later
  const ok = user.password === password;
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

// simple middleware you can use to protect routes
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'unauthorized' }); }
}

// example: protect patient creation
// app.post('/patients', auth, async (req, res, next) => { ... })



