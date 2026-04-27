import sharp from "sharp";

// OPTIMIZAR IMÁGENES (SHARP)
// =========================================================
export const optimize = async (files: Express.Multer.File[]) => {
  const processed = [];

  for (const file of files) {
    if (!file.mimetype.startsWith("image/")) {
      processed.push(file);
      continue;
    }

    const optimizedBuffer = await sharp(file.buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 100 })
      .toBuffer();

    processed.push({
      ...file,
      buffer: optimizedBuffer,
      mimetype: "image/webp",
      originalname: file.originalname.replace(/\.[^/.]+$/, "") + ".webp",
      size: optimizedBuffer.length,
    });
  }

  return processed as Express.Multer.File[];
};
