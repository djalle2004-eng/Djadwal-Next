import { NextRequest } from 'next/server';
import { serveDistFile } from '@/lib/legacyDist';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const relPath = (params.slug || []).join('/');
  return serveDistFile(relPath);
}
