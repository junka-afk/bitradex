import { Buffer } from 'buffer';

export default async (req: Request) => {
  const githubToken = process.env.GITHUB_TOKEN;
  const githubOwner = process.env.GITHUB_OWNER;
  const githubRepo = process.env.GITHUB_REPO;
  const githubBranch = process.env.GITHUB_BRANCH || 'main';
  const dataFilePath = process.env.DATA_FILE_PATH || 'data.json';

  // Validate required environment variables
  if (!githubToken || !githubOwner || !githubRepo) {
    const missing = [];
    if (!githubToken) missing.push('GITHUB_TOKEN');
    if (!githubOwner) missing.push('GITHUB_OWNER');
    if (!githubRepo) missing.push('GITHUB_REPO');

    return new Response(
      JSON.stringify({
        error: `Missing required environment variable(s): ${missing.join(', ')}. Please configure them in Netlify.`,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const githubUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${dataFilePath}`;

  const commonHeaders = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Netlify-Function-GitHub-Data',
  };

  if (req.method === 'GET') {
    try {
      const response = await fetch(`${githubUrl}?ref=${githubBranch}`, {
        method: 'GET',
        headers: commonHeaders,
      });

      if (response.status === 404) {
        return new Response(JSON.stringify({ error: 'Data file not found on GitHub' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API returned status ${response.status}: ${errorText}`);
      }

      const fileData = await response.json() as { content: string; encoding: string };
      
      // Clean up whitespace/newlines from base64 content if any
      const base64Content = fileData.content.replace(/\s/g, '');
      const decodedData = Buffer.from(base64Content, 'base64').toString('utf-8');

      return new Response(decodedData, {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();

      // 1. Get the current SHA of the file if it exists, to allow updating
      let sha: string | undefined;
      const getFileResponse = await fetch(`${githubUrl}?ref=${githubBranch}`, {
        method: 'GET',
        headers: commonHeaders,
      });

      if (getFileResponse.ok) {
        const fileMetadata = await getFileResponse.json() as { sha: string };
        sha = fileMetadata.sha;
      } else if (getFileResponse.status !== 404) {
        const errorText = await getFileResponse.text();
        throw new Error(`Failed to retrieve file metadata from GitHub. Status: ${getFileResponse.status}. Error: ${errorText}`);
      }

      // 2. Prepare PUT payload
      const fileContentBase64 = Buffer.from(JSON.stringify(body, null, 2), 'utf-8').toString('base64');
      const putPayload = {
        message: 'Update data.json via Netlify Function',
        content: fileContentBase64,
        branch: githubBranch,
        ...(sha ? { sha } : {}),
      };

      // 3. Update or create the file on GitHub
      const putResponse = await fetch(githubUrl, {
        method: 'PUT',
        headers: {
          ...commonHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(putPayload),
      });

      if (!putResponse.ok) {
        const errorText = await putResponse.text();
        throw new Error(`GitHub API update failed with status ${putResponse.status}: ${errorText}`);
      }

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
