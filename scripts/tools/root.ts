import { execSync } from "child_process";
import {
  resolve,
} from "path";
import { tsImport } from "tsx/esm/api";
import { fileURLToPath } from "url";

export const rootUrl = new URL("../../", import.meta.url).href;
export const rootDir = fileURLToPath(rootUrl);

export function execFromRoot(command: string): void {
  execSync(command, {
    stdio: "inherit",
    cwd: rootDir
  });
}

export async function tsImportFromRoot<T>(specifier: string): Promise<T> {
  return await tsImport(specifier, rootUrl);
}

export function resolvePathFromRoot(path: string): string {
  return resolve(rootDir, path);
}
