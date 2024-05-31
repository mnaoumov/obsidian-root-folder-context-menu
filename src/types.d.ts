// TODO: Remove when https://github.com/Fevol/obsidian-typings/pull/60/ is merged

export { };

declare module "obsidian" {
  interface InternalPlugin {
    enable(): Promise<void>;
  }
}
