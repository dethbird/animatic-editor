// Shape of the parsed Fountain import payload.
// The app parses .fountain files directly via fountainParser.ts.

export type FountainPanel = {
  id: string;
  title?: string;
  image?: string;             // URL or local path
  audio?: string;             // URL or local path
  duration?: number;          // seconds; fallback order: explicit → audio duration → 3s default
  act?: string;
  scene?: string;
  sequence?: string;
  text?: string;
};

export type FountainImportPayload = {
  title: string;
  panels: FountainPanel[];
};

// Result produced by the import pipeline before timeline generation
export type ImportAssetStatus = {
  url: string;
  assetId: string;
  status: 'ready' | 'error';
  error?: string;
};

export type ImportReport = {
  total: number;
  downloaded: number;
  failed: number;
  assets: ImportAssetStatus[];
};
