/**
 * @todo Remove when {@link https://github.com/Fevol/obsidian-typings/pull/60/} is included in the NPM release
 */

export { };

declare module "obsidian" {
  interface InternalPlugin {
    enable(): Promise<void>;
  }
}
