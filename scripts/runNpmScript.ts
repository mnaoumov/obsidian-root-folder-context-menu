import { existsSync } from "fs";
import { tsImportFromRoot } from "./tools/root.ts";
import process from "process";

interface ScriptModule {
  default: () => Promise<void>;
}

async function main(): Promise<void> {
  const scriptName = process.argv[2] || "";

  try {
    await runNpmScript(scriptName);
  } catch (e) {
    printError(e);
    process.exit(1);
  }
}

async function runNpmScript(scriptName: string): Promise<void> {
  if (!scriptName) {
    throw new Error("Script name is not provided");
  }

  const scriptPath = `scripts/npm/${scriptName}.ts`;

  if (!existsSync(scriptPath)) {
    throw new Error(`Script file "${scriptPath}" does not exist`);
  }

  let scriptModule;

  try {
    scriptModule = await tsImportFromRoot<ScriptModule>(scriptPath);
  } catch (e) {
    throw new Error(`Could not load script ${scriptName}`, { cause: e });
  }

  const scriptFn = scriptModule.default;

  if (typeof scriptFn !== "function") {
    throw new Error(`Script ${scriptName} does not export function`);
  }

  try {
    console.log(`Executing script ${scriptName}`);
    await scriptFn();
  } catch (e) {
    throw new Error(`Script ${scriptName} failed`, { cause: e });
  }
}

function printError(error: unknown, level: number = 0): void {
  if (error === undefined) {
    return;
  }

  const indent = "  ".repeat(level);

  if (!(error instanceof Error)) {
    let str = "";

    if (error === null) {
      str = "(null)";
    } else if (typeof error === "object") {
      str = JSON.stringify(error);
    } else {
      str = error.toString();
    }

    console.error(`${indent}${str}`);
    return;
  }

  if (!error.stack) {
    console.error(`${indent}${error.name}: ${error.message}`);
  } else {
    const stackLines = error.stack.split("\n").map(line => `${indent}${line}`);
    console.error(stackLines.join("\n"));
  }

  if (error.cause !== undefined) {
    console.error(`${indent}Caused by:`);
    printError(error.cause, level + 1);
  }
}

await main();
