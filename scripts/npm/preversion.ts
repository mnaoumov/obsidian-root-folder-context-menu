import process from "process";

export default async function preversion(): Promise<void> {
  const oldVersion = process.env["npm_package_version"];

  if (!oldVersion) {
    throw new Error("package.json version is not set");
  }

  throw new Error(oldVersion);
}
