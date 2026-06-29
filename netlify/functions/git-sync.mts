import type { Context } from '@netlify/functions'
import { promises as fs } from 'fs'
import { execSync } from 'child_process'
import path from 'path'

export default async (req: Request, context: Context) => {
  const method = req.method;
  const dataFilePath = path.join(process.cwd(), 'org_data.json');

  if (method === 'POST') {
    try {
      const body = await req.json();
      if (!body) {
        return Response.json({ success: false, error: 'No data provided' }, { status: 400 });
      }

      // 1. Write the updated data to org_data.json in the repository root
      await fs.writeFile(dataFilePath, JSON.stringify(body, null, 2), 'utf-8');

      // 2. Try to perform git operations
      let gitStatus = 'Saved locally';
      try {
        // Run git commands
        try {
          execSync('git add org_data.json', { cwd: process.cwd(), stdio: 'ignore' });
        } catch (e) {
          // If git add fails, just log and continue
        }
        
        // Check if there are changes staged
        let isChanged = false;
        try {
          const statusOutput = execSync('git status --porcelain', { cwd: process.cwd() }).toString();
          if (statusOutput.includes('org_data.json')) {
            isChanged = true;
          }
        } catch (e) {
          // Fallback if status fails
          isChanged = true;
        }

        if (isChanged) {
          try {
            execSync('git commit -m "Update organization data from UI"', { cwd: process.cwd(), stdio: 'ignore' });
            gitStatus = 'Committed locally';
          } catch (e) {
            // Commit might fail if user identity is not set
          }
          
          try {
            execSync('git push', { cwd: process.cwd(), stdio: 'ignore' });
            gitStatus = 'Committed and pushed to GitHub';
          } catch (pushErr: any) {
            gitStatus += ' (push not available)';
          }
        } else {
          gitStatus = 'No changes to commit';
        }
      } catch (gitErr: any) {
        gitStatus = `Saved but git error: ${gitErr.message}`;
      }

      return Response.json({
        success: true,
        message: 'Organization data saved successfully!',
        gitStatus: gitStatus
      });
    } catch (err: any) {
      return Response.json({
        success: false,
        error: err.message
      }, { status: 500 });
    }
  } else if (method === 'GET') {
    try {
      // 1. Try to pull latest changes from GitHub before reading
      let gitStatus = 'Loaded from workspace';
      try {
        execSync('git pull', { cwd: process.cwd(), stdio: 'ignore' });
        gitStatus = 'Pulled and loaded from GitHub';
      } catch (gitErr: any) {
        gitStatus = 'Loaded from local workspace';
      }

      // 2. Read the file
      let data;
      try {
        const fileContent = await fs.readFile(dataFilePath, 'utf-8');
        data = JSON.parse(fileContent);
      } catch (readErr) {
        return Response.json({
          success: false,
          error: 'No saved organization data found on GitHub/repository. Please save some data first.',
          gitStatus: gitStatus
        });
      }

      return Response.json({
        success: true,
        data: data,
        gitStatus: gitStatus
      });
    } catch (err: any) {
      return Response.json({
        success: false,
        error: err.message
      }, { status: 500 });
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
