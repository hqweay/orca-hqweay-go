export interface PublishSettings {
  imageBed?: {
    owner?: string;
    repo?: string;
    branch?: string;
    path?: string;
    token?: string;
  };
  blog?: {
    owner?: string;
    repo?: string;
    branch?: string;
    path?: string;
    domain?: string;
    token?: string;
  };
  tagLabel?: string;
  poetryTag?: string;
  [key: string]: any; // Allows for dynamic settings inheritance if needed
}

export interface MarkdownResult {
  markdown: string;
  title: string;
  tags: string[];
}

export interface GitHubFileResult {
  sha?: string;
  download_url?: string;
}

export interface ImageLink {
  fullMatch: string;
  alt: string;
  url: string;
}
