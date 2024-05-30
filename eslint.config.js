import { tsImport } from "tsx/esm/api";
const module = await tsImport("./eslint.config.ts", import.meta.url);
const configs = module.default;
export default configs;
