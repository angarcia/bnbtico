export function initializeRun(root: string): Promise<void>;
export function sanitizeRun(options: {
  root: string;
  input?: "raw" | "render";
  output?: "clean" | "publish";
}): Promise<{
  schema: number;
  playwright: string;
  files: number;
  authPayloadsOmitted: number;
  verified: boolean;
}>;
