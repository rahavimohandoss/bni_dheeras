// Self-host the QR decoder's WebAssembly file instead of loading it from a CDN.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// Resolve from node_modules directly: the package's "exports" hides package.json.
const candidates = [
  join("node_modules", "zxing-wasm", "dist", "reader", "zxing_reader.wasm"),
  join("node_modules", "barcode-detector", "node_modules", "zxing-wasm", "dist", "reader", "zxing_reader.wasm"),
];
const source = candidates.find((p) => existsSync(p));
if (!source) {
  console.warn("zxing_reader.wasm not found; the QR scanner will fall back to the CDN.");
  process.exit(0);
}
mkdirSync(join("public", "wasm"), { recursive: true });
copyFileSync(source, join("public", "wasm", "zxing_reader.wasm"));
console.log(`copied ${source} -> public/wasm/`);
