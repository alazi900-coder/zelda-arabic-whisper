// Web Worker that runs the full local-build pipeline off the main thread,
// keeping the editor UI responsive while large MSBT files are being parsed,
// re-encoded and compressed.
//
// Communication protocol:
//   ┌─ main ─────────────► worker
//   │   { type: "start", options: WorkerBuildOptions }
//   │
//   ┌─ worker ──────────► main
//   │   { type: "progress", message: string }
//   │   { type: "result",   result: LocalBuildResult }
//   │   { type: "error",    message, isLocalBuildError, diagnostics? }

import {
  localBuild,
  LocalBuildError,
  type LocalBuildOptions,
  type LocalBuildResult,
  type BuildDecompressDiagnostics,
} from "@/lib/local-build";

export type WorkerBuildOptions = Omit<LocalBuildOptions, "onProgress">;

export type WorkerInbound = { type: "start"; options: WorkerBuildOptions };

export type WorkerOutbound =
  | { type: "progress"; message: string }
  | { type: "result"; result: LocalBuildResult }
  | {
      type: "error";
      message: string;
      isLocalBuildError: boolean;
      diagnostics?: BuildDecompressDiagnostics;
    };

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<WorkerInbound>) => {
  if (e.data?.type !== "start") return;
  const { options } = e.data;
  try {
    const result = await localBuild({
      ...options,
      onProgress: (message) => {
        const msg: WorkerOutbound = { type: "progress", message };
        ctx.postMessage(msg);
      },
    });
    const out: WorkerOutbound = { type: "result", result };
    ctx.postMessage(out);
  } catch (err) {
    if (err instanceof LocalBuildError) {
      const out: WorkerOutbound = {
        type: "error",
        message: err.message,
        isLocalBuildError: true,
        diagnostics: err.diagnostics,
      };
      ctx.postMessage(out);
    } else {
      const out: WorkerOutbound = {
        type: "error",
        message: err instanceof Error ? err.message : "خطأ غير معروف",
        isLocalBuildError: false,
      };
      ctx.postMessage(out);
    }
  }
};
