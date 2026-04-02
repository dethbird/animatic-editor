import type { Asset } from './media';
import type { Sequence } from './timeline';
import type { ExportSettings } from './export';

export type SourceScript = {
  kind: 'fountain-import';
  path?: string;
  importedAt?: string;
};

export type Project = {
  version: number;
  id: string;
  name: string;
  filePath?: string;          // absolute path to animatic.json on disk
  createdAt: string;          // ISO 8601
  updatedAt: string;          // ISO 8601
  sourceScript?: SourceScript;
  assets: Asset[];
  sequences: Sequence[];
  activeSequenceId: string;
  exportSettings: ExportSettings;
};
