declare module "@typescript-eslint/eslint-plugin" {
  import type {
    ESLint,
    Linter
  } from "eslint";

  type Config = {
    overrides: Config[];
    rules: Linter.RulesRecord;
  }

  const plugin: ESLint.Plugin & {
    configs: Record<string, Config>
  };
  export default plugin;
}

declare module "eslint-plugin-import" {
  import type {
    ESLint
  } from "eslint";

  const plugin: ESLint.Plugin;
  export default plugin;
}

declare module "eslint-plugin-modules-newlines" {
  import type {
    ESLint
  } from "eslint";

  const plugin: ESLint.Plugin;
  export default plugin;
}

declare module "globals" {
  interface Globals {
    [name: string]: boolean | "writable" | "readonly" | "off";
  }

  const globals: {
    browser: Globals;
    node: Globals;
  };
  export default globals;
}
