import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Variables de entorno de Supabase no encontradas");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
    },
  },
);

// =========================================================
// SUBIR ARCHIVOS A SUPABASE STORAGE
// =========================================================
export async function uploadFiles(
  files: Express.Multer.File | Express.Multer.File[],
  bucket: string,
  pathPrefix: string,
  retries = 5,
): Promise<string | string[]> {
  const array = Array.isArray(files) ? files : [files];

  const upload = array.map(async (file) => {
    const path = `${pathPrefix}/${Date.now()}_${file.originalname}`;
    let attempts = 0;
    let lastError: any = null;

    while (attempts < retries) {
      try {
        const fileBlob = new Blob([file.buffer], { type: file.mimetype });

        const { error } = await supabaseAdmin.storage
          .from(bucket)
          .upload(path, fileBlob, {
            contentType: file.mimetype,
            upsert: true,
          });

        if (error) {
          throw error;
        }

        const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
      } catch (err: any) {
        lastError = err;

        // Atrapamos ECONNRESET, UND_ERR_SOCKET y 'fetch failed' para reintentar
        const isNetworkError =
          err.__isStorageError ||
          err.originalError?.code === "ECONNRESET" ||
          err.cause?.code === "UND_ERR_SOCKET" ||
          err.message?.includes("fetch failed");

        if (isNetworkError && attempts < retries) {
          attempts++;
          console.warn(
            `Error de red para ${file.originalname}. Reintentando... (Intento ${attempts}/${retries})`,
          );
          await new Promise((res) => setTimeout(res, 1000 * attempts));
        } else {
          throw err;
        }
      }
    }
    throw lastError;
  });

  const urls = await Promise.all(upload);

  return Array.isArray(files) ? urls : urls[0];
}

// =========================================================
// BORRAR ARCHIVOS DE SUPABASE STORAGE
// =========================================================
export async function deleteFiles(urls: string[]) {
  const bucketMap: Record<string, string[]> = {};

  urls.forEach((url) => {
    const parts = url.split("/public/");
    if (parts[1]) {
      const decoded = decodeURIComponent(parts[1]);

      const slashIndex = decoded.indexOf("/");
      if (slashIndex !== -1) {
        const bucketName = decoded.substring(0, slashIndex);
        const filePath = decoded.substring(slashIndex + 1);

        if (!bucketMap[bucketName]) {
          bucketMap[bucketName] = [];
        }
        bucketMap[bucketName].push(filePath);
      }
    }
  });

  const promises = Object.keys(bucketMap).map(async (bucketName) => {
    const paths = bucketMap[bucketName];
    if (paths.length > 0) {
      const { error } = await supabaseAdmin.storage.from(bucketName).remove(paths);
      if (error) {
        console.error(`Error al borrar archivos del bucket '${bucketName}':`, error);
      } else {
        console.log(`${paths.length} archivos borrados del bucket '${bucketName}'`);
      }
    }
  });

  await Promise.all(promises);
}
