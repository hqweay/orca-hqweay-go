export interface GitHubFileResult {
  sha?: string;
  download_url?: string;
}

/**
 * A thin wrapper over GitHub's contents API.
 * This adapter contains NO domain logic (e.g. it doesn't know about blogs vs image beds).
 */

export async function getFileSha(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string,
): Promise<GitHubFileResult | null> {
  // Add timestamp to prevent caching
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}&t=${Date.now()}`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (res.status === 401 || res.status === 403) {
      throw new Error(`GitHub API Auth Error: ${res.status} ${res.statusText}`);
    }
    if (!res.ok) {
      console.warn(`getFileSha failed: ${res.status} ${res.statusText}`);
      return null;
    }
    const data = await res.json();
    return {
      sha: data.sha,
      download_url: data.download_url,
    };
  } catch (e) {
    console.warn("getFileSha error:", e);
    return null;
  }
}

export async function uploadFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string,
  content: string, // Base64 encoded
  message: string,
  sha?: string,
  committerName: string = "orca-bot",
  committerEmail: string = "bot@orca.note",
) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const body: any = {
    message,
    content,
    branch,
    committer: { name: committerName, email: committerEmail },
  };
  if (sha) body.sha = sha;

  const maxRetries = 2;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        if ((res.status === 502 || res.status === 503) && attempt < maxRetries) {
          attempt++;
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
      }

      return await res.json();
    } catch (e) {
      if (attempt >= maxRetries) throw e;
      attempt++;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}
