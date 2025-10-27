

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




