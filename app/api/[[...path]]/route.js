import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { getDb } from '@/lib/mongo';
import {
  signAdminToken, signParticipantToken,
  getAdminFromRequest, getParticipantFromRequest
} from '@/lib/auth';
import { savePhoto, readPhoto, deleteParticipantPhotos } from '@/lib/storage';
import { checkMagicBytes, MAX_FILE_SIZE, PHOTO_STEPS } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function badRequest(msg) { return json({ error: msg }, 400); }
function unauthorized(msg = 'Unauthorized') { return json({ error: msg }, 401); }
function notFound(msg = 'Not found') { return json({ error: msg }, 404); }
function serverError(msg) { return json({ error: msg || 'Server error' }, 500); }

// Simple in-memory rate limit (per-process)
const rateLimitStore = new Map();
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const arr = rateLimitStore.get(key) || [];
  const filtered = arr.filter((t) => now - t < windowMs);
  if (filtered.length >= limit) {
    return false;
  }
  filtered.push(now);
  rateLimitStore.set(key, filtered);
  return true;
}

function getIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function sanitizeString(s, maxLen = 200) {
  if (typeof s !== 'string') return '';
  return s.replace(/[<>]/g, '').trim().slice(0, maxLen);
}

function routeMatch(parts, pattern) {
  if (parts.length !== pattern.length) return null;
  const params = {};
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i];
    if (p.startsWith(':')) {
      params[p.slice(1)] = parts[i];
    } else if (p !== parts[i]) {
      return null;
    }
  }
  return params;
}

async function handler(request, { params }) {
  try {
    const pathArr = params?.path || [];
    const method = request.method;
    const route = pathArr.join('/');

    // Health check
    if (method === 'GET' && route === '') {
      return json({ status: 'ok', service: 'palm-dataset-platform' });
    }

    // ===== PARTICIPANT ENDPOINTS =====

    // POST /api/participants
    if (method === 'POST' && route === 'participants') {
      const ip = getIp(request);
      if (!rateLimit(`participants:${ip}`, 10, 60 * 60 * 1000)) {
        return json({ error: 'Too many submissions from this IP. Try again later.' }, 429);
      }
      const body = await request.json();
      const age = parseInt(body.age, 10);
      const gender = sanitizeString(body.gender, 30);
      const profession = sanitizeString(body.profession, 200);
      const country = sanitizeString(body.country, 80);
      const email = body.email ? sanitizeString(body.email, 120) : null;
      const consentGiven = !!body.consentGiven;

      if (!age || age < 18 || age > 120) return badRequest('Age must be between 18 and 120');
      if (!['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'].includes(gender)) return badRequest('Invalid gender');
      if (!profession) return badRequest('Profession required');
      if (!country) return badRequest('Country required');
      if (!consentGiven) return badRequest('Consent required');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest('Invalid email');

      const db = await getDb();
      const id = uuidv4();
      const now = new Date();
      await db.collection('participants').insertOne({
        id, age, gender, profession, country, email,
        consentGiven, consentTimestamp: now,
        status: 'IN_PROGRESS',
        createdAt: now, updatedAt: now,
      });
      const sessionToken = signParticipantToken({ participantId: id });
      return json({ participantId: id, sessionToken });
    }

    // POST /api/photos/upload  (multipart)
    if (method === 'POST' && route === 'photos/upload') {
      const ip = getIp(request);
      if (!rateLimit(`upload:${ip}`, 200, 60 * 60 * 1000)) {
        return json({ error: 'Too many uploads. Try again later.' }, 429);
      }
      const participant = getParticipantFromRequest(request);
      if (!participant) return unauthorized('Invalid session');

      const formData = await request.formData();
      const file = formData.get('image');
      const hand = sanitizeString(formData.get('hand'), 10);
      const cameraType = sanitizeString(formData.get('cameraType'), 10);
      const backgroundNumber = parseInt(formData.get('backgroundNumber'), 10);
      const validationChecksRaw = formData.get('validationChecks');

      if (!file || typeof file === 'string') return badRequest('No image file');
      if (!['LEFT', 'RIGHT'].includes(hand)) return badRequest('Invalid hand');
      if (!['FRONT', 'BACK'].includes(cameraType)) return badRequest('Invalid cameraType');
      if (![1, 2, 3].includes(backgroundNumber)) return badRequest('Invalid backgroundNumber');

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length > MAX_FILE_SIZE) return badRequest('File too large (max 12MB)');

      const magic = checkMagicBytes(buffer);
      if (!magic.ok) return badRequest('Invalid file type. Must be JPEG or PNG.');

      let validationChecks = {};
      try { validationChecks = JSON.parse(validationChecksRaw || '{}'); } catch {}

      const ext = magic.type === 'png' ? 'png' : 'jpg';
      const filename = `${hand.toLowerCase()}_${cameraType.toLowerCase()}_${backgroundNumber}.${ext}`;
      const storagePath = await savePhoto(participant.participantId, filename, buffer);

      const db = await getDb();
      // Remove any existing photo for same slot (replace on retake)
      const existing = await db.collection('photos').findOne({
        participantId: participant.participantId, hand, cameraType, backgroundNumber,
      });
      if (existing) {
        await db.collection('photos').deleteOne({ id: existing.id });
      }
      const photoId = uuidv4();
      const validationPassed = Object.values(validationChecks).every((v) => v === true);
      await db.collection('photos').insertOne({
        id: photoId,
        participantId: participant.participantId,
        hand, cameraType, backgroundNumber,
        storagePath,
        fileSizeBytes: buffer.length,
        imageWidth: parseInt(formData.get('imageWidth'), 10) || 0,
        imageHeight: parseInt(formData.get('imageHeight'), 10) || 0,
        validationPassed,
        validationChecks,
        uploadedAt: new Date(),
      });

      return json({ photoId, validationPassed, validationChecks });
    }

    // GET /api/photos/list
    if (method === 'GET' && route === 'photos/list') {
      const participant = getParticipantFromRequest(request);
      if (!participant) return unauthorized();
      const db = await getDb();
      const photos = await db.collection('photos').find({ participantId: participant.participantId }).toArray();
      return json({ photos: photos.map((p) => ({
        id: p.id, hand: p.hand, cameraType: p.cameraType,
        backgroundNumber: p.backgroundNumber, validationPassed: p.validationPassed,
        validationChecks: p.validationChecks, uploadedAt: p.uploadedAt,
      })) });
    }

    // POST /api/submissions/complete
    if (method === 'POST' && route === 'submissions/complete') {
      const participant = getParticipantFromRequest(request);
      if (!participant) return unauthorized();
      const db = await getDb();
      const photos = await db.collection('photos').find({ participantId: participant.participantId }).toArray();
      if (photos.length < 12) return badRequest(`Only ${photos.length}/12 photos uploaded`);
      const now = new Date();
      await db.collection('participants').updateOne(
        { id: participant.participantId },
        { $set: { status: 'SUBMITTED', updatedAt: now, submittedAt: now } }
      );
      const referenceCode = participant.participantId.slice(0, 8).toUpperCase();
      return json({ submissionId: participant.participantId, referenceCode });
    }

    // ===== ADMIN ENDPOINTS =====

    // POST /api/admin/login
    if (method === 'POST' && route === 'admin/login') {
      const ip = getIp(request);
      if (!rateLimit(`login:${ip}`, 20, 15 * 60 * 1000)) {
        return json({ error: 'Too many login attempts. Try again later.' }, 429);
      }
      const body = await request.json();
      const email = sanitizeString(body.email, 120).toLowerCase();
      const password = body.password;
      const expectedEmail = (process.env.ADMIN_EMAIL || 'admin@palm.local').toLowerCase();
      const expectedPassword = process.env.ADMIN_PASSWORD || 'Palm@2025!';
      if (email !== expectedEmail || password !== expectedPassword) {
        return unauthorized('Invalid credentials');
      }
      const token = signAdminToken({ email });
      const res = json({ ok: true, email });
      res.cookies.set('admin_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 8 * 60 * 60,
      });
      return res;
    }

    // POST /api/admin/logout
    if (method === 'POST' && route === 'admin/logout') {
      const res = json({ ok: true });
      res.cookies.set('admin_token', '', { httpOnly: true, path: '/', maxAge: 0 });
      return res;
    }

    // GET /api/admin/me
    if (method === 'GET' && route === 'admin/me') {
      const admin = getAdminFromRequest(request);
      if (!admin) return unauthorized();
      return json({ email: admin.email });
    }

    // GET /api/admin/dashboard
    if (method === 'GET' && route === 'admin/dashboard') {
      const admin = getAdminFromRequest(request);
      if (!admin) return unauthorized();
      const db = await getDb();
      const total = await db.collection('participants').countDocuments();
      const submitted = await db.collection('participants').countDocuments({ status: 'SUBMITTED' });
      const inProgress = await db.collection('participants').countDocuments({ status: 'IN_PROGRESS' });
      const rejected = await db.collection('participants').countDocuments({ status: 'REJECTED' });
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
      const today = await db.collection('participants').countDocuments({ createdAt: { $gte: startOfToday } });
      const genderAgg = await db.collection('participants').aggregate([
        { $group: { _id: '$gender', count: { $sum: 1 } } },
      ]).toArray();
      const profAgg = await db.collection('participants').aggregate([
        { $group: { _id: '$profession', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]).toArray();
      const countryAgg = await db.collection('participants').aggregate([
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]).toArray();
      const totalPhotos = await db.collection('photos').countDocuments();
      return json({
        total, submitted, inProgress, rejected, today, totalPhotos,
        genderBreakdown: genderAgg.map((g) => ({ gender: g._id, count: g.count })),
        topProfessions: profAgg.map((p) => ({ profession: p._id, count: p.count })),
        topCountries: countryAgg.map((c) => ({ country: c._id, count: c.count })),
      });
    }

    // GET /api/admin/submissions?page=&limit=&status=&gender=&search=
    if (method === 'GET' && route === 'admin/submissions') {
      const admin = getAdminFromRequest(request);
      if (!admin) return unauthorized();
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
      const status = url.searchParams.get('status');
      const gender = url.searchParams.get('gender');
      const search = url.searchParams.get('search');
      const dateFrom = url.searchParams.get('dateFrom');
      const dateTo = url.searchParams.get('dateTo');

      const query = {};
      if (status) query.status = status;
      if (gender) query.gender = gender;
      if (search) {
        query.$or = [
          { profession: { $regex: search, $options: 'i' } },
          { country: { $regex: search, $options: 'i' } },
          { id: { $regex: search, $options: 'i' } },
        ];
      }
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      const db = await getDb();
      const total = await db.collection('participants').countDocuments(query);
      const items = await db.collection('participants')
        .find(query).sort({ createdAt: -1 })
        .skip((page - 1) * limit).limit(limit).toArray();

      // Photo counts per participant
      const ids = items.map((i) => i.id);
      const photoCounts = await db.collection('photos').aggregate([
        { $match: { participantId: { $in: ids } } },
        { $group: { _id: '$participantId', count: { $sum: 1 }, passed: { $sum: { $cond: ['$validationPassed', 1, 0] } } } },
      ]).toArray();
      const countMap = new Map(photoCounts.map((c) => [c._id, c]));
      const enriched = items.map((p) => {
        const c = countMap.get(p.id) || { count: 0, passed: 0 };
        return {
          id: p.id, age: p.age, gender: p.gender, profession: p.profession,
          country: p.country, status: p.status, email: p.email,
          createdAt: p.createdAt, photoCount: c.count, photoPassed: c.passed,
        };
      });
      return json({ items: enriched, total, page, limit, totalPages: Math.ceil(total / limit) });
    }

    // GET /api/admin/submissions/:id
    {
      const m = routeMatch(pathArr, ['admin', 'submissions', ':id']);
      if (m && method === 'GET') {
        const admin = getAdminFromRequest(request);
        if (!admin) return unauthorized();
        const db = await getDb();
        const p = await db.collection('participants').findOne({ id: m.id });
        if (!p) return notFound();
        const photos = await db.collection('photos').find({ participantId: m.id }).toArray();
        return json({
          participant: {
            id: p.id, age: p.age, gender: p.gender, profession: p.profession,
            country: p.country, status: p.status, email: p.email,
            createdAt: p.createdAt, updatedAt: p.updatedAt, consentGiven: p.consentGiven,
          },
          photos: photos.map((ph) => ({
            id: ph.id, hand: ph.hand, cameraType: ph.cameraType,
            backgroundNumber: ph.backgroundNumber, validationPassed: ph.validationPassed,
            validationChecks: ph.validationChecks, fileSizeBytes: ph.fileSizeBytes,
            imageWidth: ph.imageWidth, imageHeight: ph.imageHeight, uploadedAt: ph.uploadedAt,
          })),
        });
      }
    }

    // PATCH /api/admin/submissions/:id/status
    {
      const m = routeMatch(pathArr, ['admin', 'submissions', ':id', 'status']);
      if (m && method === 'PATCH') {
        const admin = getAdminFromRequest(request);
        if (!admin) return unauthorized();
        const body = await request.json();
        const newStatus = sanitizeString(body.status, 20);
        if (!['SUBMITTED', 'REJECTED', 'IN_PROGRESS'].includes(newStatus)) return badRequest('Invalid status');
        const db = await getDb();
        await db.collection('participants').updateOne(
          { id: m.id }, { $set: { status: newStatus, updatedAt: new Date() } }
        );
        return json({ ok: true });
      }
    }

    // GET /api/admin/photo/:photoId  -> returns image bytes
    {
      const m = routeMatch(pathArr, ['admin', 'photo', ':photoId']);
      if (m && method === 'GET') {
        const admin = getAdminFromRequest(request);
        if (!admin) return unauthorized();
        const db = await getDb();
        const photo = await db.collection('photos').findOne({ id: m.photoId });
        if (!photo) return notFound();
        const buf = await readPhoto(photo.storagePath);
        const ext = photo.storagePath.split('.').pop().toLowerCase();
        const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
        return new Response(buf, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'private, max-age=300',
          },
        });
      }
    }

    // GET /api/admin/export  -> returns ZIP
    if (method === 'GET' && route === 'admin/export') {
      const admin = getAdminFromRequest(request);
      if (!admin) return unauthorized();
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const gender = url.searchParams.get('gender');
      const dateFrom = url.searchParams.get('dateFrom');
      const dateTo = url.searchParams.get('dateTo');
      const query = {};
      if (status) query.status = status;
      if (gender) query.gender = gender;
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }
      const db = await getDb();
      const participants = await db.collection('participants').find(query).toArray();
      const ids = participants.map((p) => p.id);
      const photos = await db.collection('photos').find({ participantId: { $in: ids } }).toArray();

      const zip = new JSZip();
      // CSV
      const csvLines = ['participant_id,age,gender,profession,country,email,status,created_at,photo_count'];
      const photosByPid = new Map();
      for (const ph of photos) {
        if (!photosByPid.has(ph.participantId)) photosByPid.set(ph.participantId, []);
        photosByPid.get(ph.participantId).push(ph);
      }
      for (const p of participants) {
        const cnt = (photosByPid.get(p.id) || []).length;
        const line = [
          p.id, p.age, p.gender,
          (p.profession || '').replace(/,/g, ' '),
          p.country, p.email || '', p.status,
          p.createdAt?.toISOString() || '', cnt,
        ].join(',');
        csvLines.push(line);
      }
      zip.file('metadata.csv', csvLines.join('\n'));

      // Photo manifest
      const manifestLines = ['photo_id,participant_id,hand,camera,bg,validation_passed,file'];
      for (const ph of photos) {
        try {
          const buf = await readPhoto(ph.storagePath);
          const ext = ph.storagePath.split('.').pop();
          const filename = `images/${ph.participantId}/${ph.hand.toLowerCase()}_${ph.cameraType.toLowerCase()}_${ph.backgroundNumber}.${ext}`;
          zip.file(filename, buf);
          manifestLines.push([
            ph.id, ph.participantId, ph.hand, ph.cameraType,
            ph.backgroundNumber, ph.validationPassed, filename,
          ].join(','));
        } catch (e) { /* skip missing files */ }
      }
      zip.file('photos_manifest.csv', manifestLines.join('\n'));

      const buf = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
      return new Response(buf, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="palm-dataset-export-${Date.now()}.zip"`,
        },
      });
    }

    // DELETE /api/admin/submissions/:id
    {
      const m = routeMatch(pathArr, ['admin', 'submissions', ':id']);
      if (m && method === 'DELETE') {
        const admin = getAdminFromRequest(request);
        if (!admin) return unauthorized();
        const db = await getDb();
        await db.collection('photos').deleteMany({ participantId: m.id });
        await db.collection('participants').deleteOne({ id: m.id });
        await deleteParticipantPhotos(m.id);
        return json({ ok: true });
      }
    }

    return notFound('Route not found: ' + route);
  } catch (err) {
    console.error('API error:', err);
    return serverError(err.message);
  }
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
export const PUT = handler;
