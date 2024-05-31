import process from "process";
import {
  execFromRoot,
  resolvePathFromRoot
} from "scripts/tools/root.ts";

export default function postversion(): void {
  execFromRoot("git push");
  execFromRoot("git push --tags");

  const newVersion = process.env["npm_package_version"];

  const buildDir = resolvePathFromRoot("dist/build");
  execFromRoot(`gh release create "${newVersion}" "${buildDir}/*" --title "v${newVersion}" --generate-notes`);
}
