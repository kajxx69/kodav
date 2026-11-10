import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { fileTypeFromBuffer } from 'file-type';
import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from './http.js';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const ATTACHMENT_TYPES = [...IMAGE_TYPES, 'application/pdf'];

/** Fichiers gardés en mémoire le temps de vérifier leur contenu réel. */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 6 },
});

const useCloudinary = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);
if (useCloudinary) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const localDir = path.resolve(import.meta.dirname, '../..', env.UPLOAD_DIR);
const ID_REGEX = /^[a-z]+\/[a-f0-9]{32}$/;

/** Type réel lu dans les premiers octets (le type annoncé par le navigateur est ignoré). */
export async function assertImage(buffer: Buffer) {
  const type = await fileTypeFromBuffer(buffer);
  if (!type || !IMAGE_TYPES.includes(type.mime)) {
    throw AppError.badRequest('Format non accepté : photo JPEG ou PNG uniquement');
  }
  return type.mime;
}

/** Pièce jointe de ticket : photo ou PDF. */
export async function assertAttachment(buffer: Buffer) {
  const type = await fileTypeFromBuffer(buffer);
  if (!type || !ATTACHMENT_TYPES.includes(type.mime)) {
    throw AppError.badRequest('Format non accepté : image JPEG, PNG ou document PDF');
  }
  return type.mime;
}

/** Les PDF sont des ressources « raw » chez Cloudinary, les photos des « image ». */
const resourceType = (folder: string) => (folder === 'tickets' ? 'raw' : 'image');

/** Enregistre un fichier sous un nom aléatoire ; renvoie son identifiant. */
export async function saveFile(buffer: Buffer, folder: string): Promise<string> {
  const publicId = `${folder}/${randomBytes(16).toString('hex')}`;
  if (useCloudinary) {
    await new Promise<void>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          // Ressource privée : accessible uniquement par une URL signée, via l'API.
          {
            public_id: `kodav/${publicId}`,
            type: 'authenticated',
            resource_type: resourceType(folder),
          },
          (err) => (err ? reject(err) : resolve()),
        )
        .end(buffer);
    });
  } else {
    await fs.mkdir(path.join(localDir, folder), { recursive: true });
    await fs.writeFile(path.join(localDir, publicId), buffer);
  }
  return publicId;
}

export async function readFile(publicId: string): Promise<Buffer> {
  if (!ID_REGEX.test(publicId)) throw AppError.notFound('Fichier introuvable');
  if (useCloudinary) {
    const url = cloudinary.url(`kodav/${publicId}`, {
      type: 'authenticated',
      sign_url: true,
      resource_type: resourceType(publicId.split('/')[0]!),
    });
    const res = await fetch(url);
    if (!res.ok) throw AppError.notFound('Fichier introuvable');
    return Buffer.from(await res.arrayBuffer());
  }
  try {
    return await fs.readFile(path.join(localDir, publicId));
  } catch {
    throw AppError.notFound('Fichier introuvable');
  }
}

export async function deleteFile(publicId: string) {
  if (!ID_REGEX.test(publicId)) return;
  if (useCloudinary) {
    await cloudinary.uploader.destroy(`kodav/${publicId}`, {
      type: 'authenticated',
      resource_type: resourceType(publicId.split('/')[0]!),
    });
  } else {
    await fs.rm(path.join(localDir, publicId), { force: true });
  }
}
