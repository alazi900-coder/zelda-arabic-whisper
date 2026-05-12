import { AlertTriangle, X, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BuildDiagnostics {
  langFileName: string;
  langSize: number;
  langHeaderHex: string;
  langHeaderAscii: string;
  isSarc: boolean;
  isZstd: boolean;
  dictFiles: string[];
  attempts: {
    dict: string;
    ok: boolean;
    outHeaderHex?: string;
    outHeaderAscii?: string;
    outSize?: number;
    error?: string;
  }[];
}

interface Props {
  message: string;
  diagnostics: BuildDiagnostics;
  onClose: () => void;
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 py-1 border-b border-border/40 last:border-0">
    <span className="text-xs font-body text-muted-foreground shrink-0">{label}</span>
    <span className="text-xs font-mono text-foreground break-all text-left" dir="ltr">{value}</span>
  </div>
);

const BuildDiagnosticsPanel = ({ message, diagnostics, onClose }: Props) => {
  return (
    <div
      dir="rtl"
      className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3"
      role="alert"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          <h3 className="font-display font-bold text-sm">تشخيص فشل فكّ الضغط</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} aria-label="إغلاق">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <p className="text-xs font-body text-foreground/90 leading-relaxed">{message}</p>

      <div className="rounded-md bg-background/60 border border-border/60 p-3 space-y-1">
        <p className="text-[11px] font-display font-bold text-muted-foreground mb-1">ملفّ اللغة</p>
        <Row label="الاسم" value={diagnostics.langFileName || "(غير معروف)"} />
        <Row label="الحجم" value={`${diagnostics.langSize.toLocaleString()} بايت`} />
        <Row label="الترويسة (hex)" value={diagnostics.langHeaderHex} />
        <Row label="الترويسة (ASCII)" value={`"${diagnostics.langHeaderAscii}"`} />
        <Row
          label="SARC؟"
          value={
            diagnostics.isSarc
              ? <span className="text-emerald-600 dark:text-emerald-400">نعم</span>
              : <span className="text-destructive">لا</span>
          }
        />
        <Row
          label="zstd؟"
          value={
            diagnostics.isZstd
              ? <span className="text-emerald-600 dark:text-emerald-400">نعم</span>
              : <span className="text-destructive">لا</span>
          }
        />
      </div>

      {diagnostics.dictFiles.length > 0 && (
        <div className="rounded-md bg-background/60 border border-border/60 p-3 space-y-1">
          <p className="text-[11px] font-display font-bold text-muted-foreground mb-1">
            القواميس المتاحة في ملفّ القاموس ({diagnostics.dictFiles.length})
          </p>
          <ul className="text-[11px] font-mono text-foreground/80 space-y-0.5" dir="ltr">
            {diagnostics.dictFiles.map((d) => <li key={d}>• {d}</li>)}
          </ul>
        </div>
      )}

      {diagnostics.attempts.length > 0 && (
        <div className="rounded-md bg-background/60 border border-border/60 p-3 space-y-2">
          <p className="text-[11px] font-display font-bold text-muted-foreground">
            محاولات فكّ الضغط ({diagnostics.attempts.length})
          </p>
          <div className="space-y-2">
            {diagnostics.attempts.map((a, i) => (
              <div
                key={`${a.dict}-${i}`}
                className={`rounded border p-2 ${
                  a.ok
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-destructive/30 bg-destructive/5"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-foreground" dir="ltr">{a.dict}</span>
                  {a.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive shrink-0" />
                  )}
                </div>
                {a.error ? (
                  <p className="mt-1 text-[11px] font-mono text-destructive break-all" dir="ltr">
                    {a.error}
                  </p>
                ) : (
                  <div className="mt-1 space-y-0.5">
                    {a.outHeaderHex && (
                      <Row label="ترويسة الناتج (hex)" value={a.outHeaderHex} />
                    )}
                    {a.outHeaderAscii && (
                      <Row label="الناتج (ASCII)" value={`"${a.outHeaderAscii}"`} />
                    )}
                    {typeof a.outSize === "number" && (
                      <Row label="حجم الناتج" value={`${a.outSize.toLocaleString()} بايت`} />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] font-body text-muted-foreground leading-relaxed">
        لو الترويسة لا تطابق <span className="font-mono">SARC</span> ولا zstd
        (<span className="font-mono">28 b5 2f fd</span>)، فالملفّ المرفوع غير صحيح.
        ولو فشلت كلّ المحاولات بقاموس مختلف، فالقاموس المرفوع لا يطابق ملفّ اللغة.
      </p>
    </div>
  );
};

export default BuildDiagnosticsPanel;
