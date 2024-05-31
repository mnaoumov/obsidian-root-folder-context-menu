import process from "process";
import { execFromRoot } from "scripts/tools/root.ts";

export default function postversion(): void {
  execFromRoot("git push");
  execFromRoot("git push --tags");

  const newVersion = process.env["npm_package_version"];

  execFromRoot(`gh release create "v${newVersion}" --title "v${newVersion}" --notes "Release of version ${newVersion}`);
}
