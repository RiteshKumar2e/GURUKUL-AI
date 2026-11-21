import fs from 'fs';
import path from 'path';

export interface ContentMeta {
  description: string;
  curriculumVerification: { status: string; verifiedOn: string; note: string; sources: string[] };
  contentLicence: string;
}

let cached: ContentMeta | null = null;

/** Reads source/verification notes from backend/content/class9-maths.json (works from src/ and dist/). */
export function contentMeta(): ContentMeta {
  if (cached) return cached;
  const file = path.resolve(__dirname, '../../content/class9-maths.json');
  cached = (JSON.parse(fs.readFileSync(file, 'utf8')) as { meta: ContentMeta }).meta;
  return cached;
}
