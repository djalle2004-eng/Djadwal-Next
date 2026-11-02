import { NextRequest } from 'next/server';
import { serveDistFile } from '@/lib/legacyDist';

export async function GET(request: NextRequest) {
  return serveDistFile('index.html');
}

