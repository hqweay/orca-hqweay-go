import { GitHubFileResult } from "./types";

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
    throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}
