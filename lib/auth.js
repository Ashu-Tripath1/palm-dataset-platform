import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export function signAdminToken(payload) {
  return jwt.sign({ ...payload, role: 'admin' }, SECRET, { expiresIn: '8h' });
}

export function signParticipantToken(payload) {
  return jwt.sign({ ...payload, role: 'participant' }, SECRET, { expiresIn: '24h' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

export function getAdminFromRequest(request) {
  const cookie = request.cookies.get('admin_token')?.value;
  if (!cookie) return null;
  const decoded = verifyToken(cookie);
  if (!decoded || decoded.role !== 'admin') return null;
  return decoded;
}

export function getParticipantFromRequest(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded || decoded.role !== 'participant') return null;
  return decoded;
}
