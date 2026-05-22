import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env';
import { logger } from './logger';

// ============================================================
// S3 Client
// ============================================================

const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
  ...(env.S3_ENDPOINT_URL
    ? {
        endpoint: env.S3_ENDPOINT_URL,
        forcePathStyle: true, // required for Supabase storage
      }
    : {}),
});

// ============================================================
// Helper Types
// ============================================================

export interface UploadResult {
  storagePath: string;
  fileSizeBytes: number;
}

// ============================================================
// Upload a buffer to S3 (PRIVATE — never publicly accessible)
// ============================================================

export async function uploadImageToS3(
  buffer: Buffer,
  key: string,
  contentType: 'image/jpeg' | 'image/png',
): Promise<UploadResult> {
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    // Enforce private ACL — no public read ever
    ACL: 'private' as const,
    // Server-side encryption
    ServerSideEncryption: 'AES256',
  });

  try {
    await s3Client.send(command);
    logger.info({ key, size: buffer.length }, 'Image uploaded to S3');
    return {
      storagePath: key,
      fileSizeBytes: buffer.length,
    };
  } catch (error) {
    logger.error({ error, key }, 'S3 upload failed');
    throw new Error(`Failed to upload image to storage: ${String(error)}`);
  }
}

// ============================================================
// Generate a presigned GET URL (admin-only, 60 min expiry)
// ============================================================

export async function getPresignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
  });

  try {
    const url = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 60 minutes
    });
    return url;
  } catch (error) {
    logger.error({ error, key }, 'Failed to generate presigned URL');
    throw new Error('Failed to generate image access URL');
  }
}

// ============================================================
// Delete a single object from S3
// ============================================================

export async function deleteImageFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
  });

  try {
    await s3Client.send(command);
    logger.info({ key }, 'Image deleted from S3');
  } catch (error) {
    logger.error({ error, key }, 'S3 delete failed');
    throw new Error('Failed to delete image from storage');
  }
}

// ============================================================
// Delete all objects under a prefix (for participant deletion)
// ============================================================

export async function deleteParticipantImages(
  participantId: string,
): Promise<void> {
  const prefix = `${participantId}/`;

  // List all objects with this prefix
  const listCommand = new ListObjectsV2Command({
    Bucket: env.S3_BUCKET_NAME,
    Prefix: prefix,
  });

  try {
    const listResult = await s3Client.send(listCommand);
    const objects = listResult.Contents;

    if (!objects || objects.length === 0) {
      logger.info({ participantId }, 'No S3 objects to delete for participant');
      return;
    }

    const deleteCommand = new DeleteObjectsCommand({
      Bucket: env.S3_BUCKET_NAME,
      Delete: {
        Objects: objects
          .filter((obj) => obj.Key !== undefined)
          .map((obj) => ({ Key: obj.Key as string })),
      },
    });

    await s3Client.send(deleteCommand);
    logger.info(
      { participantId, count: objects.length },
      'Deleted all participant images from S3',
    );
  } catch (error) {
    logger.error({ error, participantId }, 'Failed to delete participant S3 images');
    throw new Error('Failed to delete participant images from storage');
  }
}

// ============================================================
// Build the S3 key for a photo
// Format: {participantId}/{hand}_{cameraType}_{bgNumber}.jpg
// ============================================================

export function buildS3Key(
  participantId: string,
  hand: 'LEFT' | 'RIGHT',
  cameraType: 'FRONT' | 'BACK',
  backgroundNumber: number,
): string {
  return `${participantId}/${hand.toLowerCase()}_${cameraType.toLowerCase()}_bg${backgroundNumber}.jpg`;
}
