export default async (req) => {
  // Use Netlify.env.get as recommended by netlify-functions skill
  const repositoryUrl = (typeof Netlify !== 'undefined' && Netlify.env) 
    ? Netlify.env.get('REPOSITORY_URL') 
    : (process.env.REPOSITORY_URL || '');
  const branch = (typeof Netlify !== 'undefined' && Netlify.env) 
    ? Netlify.env.get('BRANCH') 
    : (process.env.BRANCH || 'main');

  let owner = '';
  let repo = '';

  if (repositoryUrl) {
    const cleanUrl = repositoryUrl.replace(/\.git$/, '');
    if (cleanUrl.includes('github.com/')) {
      const parts = cleanUrl.split('github.com/')[1].split('/');
      owner = parts[0] || '';
      repo = parts[1] || '';
    } else if (cleanUrl.includes('github.com:')) {
      const parts = cleanUrl.split('github.com:')[1].split('/');
      owner = parts[0] || '';
      repo = parts[1] || '';
    }
  }

  return new Response(JSON.stringify({ owner, repo, branch }), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
};
