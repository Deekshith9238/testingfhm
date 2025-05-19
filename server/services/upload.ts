import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// Initialize upload directory
ensureUploadDir();

export async function uploadProfilePicture(file: Express.Multer.File): Promise<string> {
  const fileExtension = path.extname(file.originalname);
  const fileName = `${randomBytes(16).toString('hex')}${fileExtension}`;
  const filePath = path.join(UPLOAD_DIR, fileName);

  // Process and optimize the image
  await sharp(file.buffer)
    .resize(400, 400, { // Resize to reasonable dimensions
      fit: 'cover',
      position: 'center'
    })
    .jpeg({ quality: 80 }) // Convert to JPEG and compress
    .toFile(filePath);

  // Return the relative path that can be stored in the database
  return `/uploads/${fileName}`;
}

export async function deleteFile(filePath: string) {
  if (!filePath) return;
  
  const fullPath = path.join(process.cwd(), filePath.replace(/^\//, ''));
  try {
    await fs.unlink(fullPath);
  } catch (error) {
    console.error('Error deleting file:', error);
  }
} 