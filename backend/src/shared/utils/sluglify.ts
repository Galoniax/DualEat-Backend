import slugify from "slugify";
import { customAlphabet } from "nanoid";

const generateHash = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 6);

export function generateSlug(baseText: string): string {
  const slug = slugify(baseText, {
    replacement: "-",
    lower: true,
    strict: true,
    trim: true,
  });

  const hash = generateHash();

  return `${slug}-${hash}`;
}

export async function generateUniqueSlug(baseText: string, model: any): Promise<string> {
    const baseSlug = slugify(baseText, { 
        strict: true,
    });
    
    let slug = baseSlug;
    let counter = 1;

    while (true) {
        const existing = await model.findFirst({
            where: { slug },
            select: { id: true }
        });

        if (!existing) {
            return slug; 
        }

        slug = `${baseSlug}${counter}`; 
        counter++;
    }
}