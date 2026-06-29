import { promises as fs } from 'fs';
import * as path from 'path';

export default async (req: Request) => {
  const filePath = path.resolve('/opt/build/repo/data.json');

  if (req.method === 'GET') {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return new Response(data, {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'No data found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      await fs.writeFile(filePath, JSON.stringify(body, null, 2), 'utf-8');
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
};

export const config = {
  path: '/api/github-data',
};
