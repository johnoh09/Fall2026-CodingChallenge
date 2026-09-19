export type Role = 'owner' | 'editor' | 'viewer';
export type ShareMode = 'private' | 'view' | 'edit';
export interface User {
  id: string;
  name: string;
  email: string | null;
  guest: boolean;
}
export interface Photo {
  id: string;
  title: string;
  tags?: string;
  url: string;
  sourceUrl: string;
  author: string;
  width: number;
  height: number;
  provider?: string;
}
export interface Pin extends Photo {
  imageId: string;
  note: string;
  version: number;
}
export interface Board {
  id: string;
  name: string;
  description: string;
  color: string;
  role: Role;
  revision: number;
  shareMode: ShareMode;
  shareToken?: string | null;
  count: number;
  covers: string[];
  pins?: Pin[];
}
export interface SearchResult {
  images: Photo[];
  total: number;
  page: number;
  provider: 'samples' | 'pixabay';
}
export interface Member {
  id: string;
  name: string;
  email: string;
}
