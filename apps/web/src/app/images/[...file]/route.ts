import { NextRequest } from 'next/server';
import { serveDistFile } from '@/lib/legacyDist';

export async function GET(
  request: NextRequest,
  { params }: { params: { file: string[] } }
) {
  const relPath = 'images/' + (params.file || []).join('/');
  return serveDistFile(relPath);
}

