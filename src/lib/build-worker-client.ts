// Main-thread client that delegates `localBuild` to a Web Worker, exposing the
// same `Promise<LocalBuildResult>` shape and forwarding progress callbacks.
//
// Spawning the worker via `new URL(..., import.meta.url)` is the Vite-supported
// pattern that emits a separate chunk and works in dev, production and the
// service-worker precache. The `{ type: "module" }` option keeps ES-module
// imports working inside the worker.

import {
  LocalBuildError,
  type LocalBuildOptions,
  type LocalBuildResult,
} from "./local-build";
import type { WorkerOutbound, WorkerInbound } from "@/workers/build.worker";

export function runLocalBuildInWorker(
  opts: LocalBuildOptions,
): Promise<LocalBuildResult> {
  return new Promise<LocalBuildResult>((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/build.worker.ts", import.meta.url),
      { type: "module" },
    );

    const cleanup = () => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    };

    worker.onmessage = (e: MessageEvent<WorkerOutbound>) => {
      const msg = e.data;
      switch (msg.type) {
        case "progress":
          opts.onProgress?.(msg.message);
          break;
        case "result":
          cleanup();
          resolve(msg.result);
          break;
        case "error":
          cleanup();
          if (msg.isLocalBuildError && msg.diagnostics) {
            reject(new LocalBuildError(msg.message, msg.diagnostics));
          } else {
            reject(new Error(msg.message));
          }
          break;
      }
    };

    worker.onerror = (err) => {
      cleanup();
      reject(new Error(err.message || "خطأ غير معروف داخل Worker البناء"));
    };

    // Strip the non-cloneable `onProgress` callback — progress is delivered via
    // `postMessage` from inside the worker instead.
    const { onProgress: _omit, ...transferable } = opts;
    void _omit;

    // Transferring the ArrayBuffers detaches them in the main thread so the
    // copy cost is zero. `handleBuild` re-reads from IndexedDB on each call,
    // so detaching is safe across rebuilds.
    const transferList: Transferable[] = [transferable.langFile];
    if (transferable.dictFile) transferList.push(transferable.dictFile);

    const payload: WorkerInbound = { type: "start", options: transferable };
    worker.postMessage(payload, transferList);
  });
}
