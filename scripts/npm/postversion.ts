import process from "process";

export default async function postversion(): Promise<void> {
  const newVersion = process.env["npm_package_version"];

  if (!newVersion) {
    throw new Error("package.json version is not set");
  }

  throw new Error(newVersion);
}
