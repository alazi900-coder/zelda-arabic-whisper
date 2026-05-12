// Lazy-initialised in-browser zstd via WebAssembly.
// Wraps @bokuweb/zstd-wasm so the whole codebase shares one init promise.

import {
  init,
  decompress,
  compress,
  createDCtx,
  decompressUsingDict,
  createCCtx,
  compressUsingDict,
} from "@bokuweb/zstd-wasm";

let initPromise: Promise<void> | null = null;

export function ensureZstdReady(): Promise<void> {
  if (!initPromise) initPromise = init();
  return initPromise;
}

export {
  decompress,
  compress,
  createDCtx,
  decompressUsingDict,
  createCCtx,
  compressUsingDict,
};
