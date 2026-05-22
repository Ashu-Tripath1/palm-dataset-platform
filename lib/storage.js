import crypto from 'crypto';

export async function savePhoto(participantId, filename, buffer) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials missing in environment variables');
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = `palm-dataset/${participantId}`;
  
  // Signature requires alphabetically sorted parameters
  const signatureString = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

  const ext = filename.split('.').pop().toLowerCase();
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const base64Data = `data:${mime};base64,${buffer.toString('base64')}`;

  const formData = new FormData();
  formData.append('file', base64Data);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('folder', folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Cloudinary upload failed: ${data.error?.message || 'Unknown error'}`);

  return data.secure_url;
}

export async function readPhoto(storagePath) {
  if (storagePath.startsWith('http')) {
    const res = await fetch(storagePath);
    if (!res.ok) throw new Error(`Failed to fetch photo from Cloudinary: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  
  // Fallback for old local files (if any exist locally)
  const fs = require('fs/promises');
  const path = require('path');
  const fullPath = path.isAbsolute(storagePath) ? storagePath : path.join(process.cwd(), storagePath);
  return await fs.readFile(fullPath);
}

export async function deleteParticipantPhotos(participantId) {
  // In a real production environment, you would use Cloudinary's Admin API to delete the folder
  // For safety and simplicity, we do not hard-delete cloud images when a submission is deleted
  console.log(`Cloud deletion skipped for participant ${participantId}`);
}

export function getStorageRoot() {
  return 'Cloudinary';
}
