import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { promises as fs } from 'fs';
import path from 'path';

// Cloudflare R2 (free tier) with local ./uploads fallback for offline dev.
const endpoint = process.env.R2_ENDPOINT || '';
const hasR2 = Boolean(process.env.R2_ACCESS_KEY_ID && endpoint);
const s3 = hasR2 ? new S3Client({
  region: 'auto',
  endpoint,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
}) : null;

export async function saveUpload(bucket: string, key: string, body: Buffer, contentType: string): Promise<string> {
  if (s3) {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
    if (bucket === process.env.R2_BUCKET_PRODUCT_IMAGES) return `${process.env.R2_PUBLIC_URL}/${key}`;
    return `r2://${bucket}/${key}`;
  }
  const dir = path.join(process.cwd(), 'uploads', bucket);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, key), body);
  return `/uploads/${bucket}/${key}`;
}

export async function signedProofUrl(bucket: string, key: string): Promise<string> {
  if (s3) {
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(s3 as any, cmd, { expiresIn: 900 });
  }
  return `/uploads/${bucket}/${key}`;
}
