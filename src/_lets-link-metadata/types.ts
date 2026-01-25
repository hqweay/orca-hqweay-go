import { PropType } from "@/libs/consts";

export interface MetadataProperty {
  name: string; // Property name in Orca
  type: number; // PropType enum value
  value: any;
  typeArgs?: any;
}

export interface Rule {
  id: string;
  name: string;
  urlPattern: string; // Regex string e.g. "/^https:\/\/movie\.douban\.com\/subject\/(\d+)(\/|\/?\?.*)?$/i"
  tagName: string; // The Tag Name to apply
  script: string[]; // JavaScript function body (array of lines for JSON readability)
  enabled: boolean;
  downloadCover?: boolean; // Whether to download cover image to local assets
}

export interface LinkMetadataSettings {
  rules: Rule[];
}
