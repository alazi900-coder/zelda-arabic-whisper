import React, { useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Upload, X, Image as ImageIcon, ZoomIn, Brain, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { ExtractedEntry } from "./types";

interface ScreenshotData {
  url: string;
  name: string;
  note?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  entry: ExtractedEntry;
  screenshots: Record<string, ScreenshotData[]>;
  onAddScreenshot: (msbtFile: string, screenshot: ScreenshotData) => void;
  onRemoveScreenshot: (msbtFile: string, index: number) => void;
}

export default function ScreenshotContext({ open, onClose, entry, screenshots, onAddScreenshot, onRemoveScreenshot }: Props) {
  const [zoomedUrl, setZoomedUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileScreenshots = screenshots[entry.msbtFile] || [];

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "❌ ملف غير صالح", description: "يرجى اختيار صورة", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "❌ حجم كبير", description: "الحد الأقصى 5 ميجابايت", variant: "destructive" });
      return;
    }

    // Convert to data URL for local storage
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      onAddScreenshot(entry.msbtFile, {
        url,
        name: file.name,
        note: note.trim() || undefined,
      });
      setNote("");
      toast({ title: "📸 تمت إضافة الصورة" });
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [entry.msbtFile, note, onAddScreenshot]);

  return (
    <>
      <Dialog open={open && !zoomedUrl} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0" dir="rtl">
          <DialogHeader className="p-4 pb-2 border-b border-border/50">
            <DialogTitle className="text-sm font-display flex items-center gap-2">
              📸 سياق بالصور
              <Badge variant="secondary" className="text-[10px]">{entry.msbtFile}</Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              أضف لقطات شاشة من اللعبة لفهم السياق البصري للنصوص
            </DialogDescription>
          </DialogHeader>

          {/* Upload section */}
          <div className="px-4 py-3 border-b border-border/30 bg-muted/20">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="ملاحظة (اختياري)..."
                className="flex-1 px-3 py-1.5 rounded bg-background border border-border text-sm font-body"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0"
              >
                <Upload className="w-3.5 h-3.5" /> رفع صورة
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3">
              {fileScreenshots.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <ImageIcon className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground">لا توجد صور لهذا الملف</p>
                  <p className="text-xs text-muted-foreground/60">ارفع لقطات شاشة من اللعبة لمساعدتك في فهم السياق</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {fileScreenshots.map((ss, i) => (
                    <div key={i} className="relative group rounded-lg overflow-hidden border border-border/30 hover:border-border/60 transition-colors">
                      <img
                        src={ss.url}
                        alt={ss.name}
                        className="w-full h-40 object-cover cursor-pointer"
                        onClick={() => setZoomedUrl(ss.url)}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                        <div className="flex-1">
                          <p className="text-[10px] text-white/80 truncate">{ss.name}</p>
                          {ss.note && <p className="text-[10px] text-white/60">{ss.note}</p>}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setZoomedUrl(ss.url)}
                            className="p-1 rounded bg-white/20 hover:bg-white/30 transition-colors"
                          >
                            <ZoomIn className="w-3.5 h-3.5 text-white" />
                          </button>
                          <button
                            onClick={() => {
                              onRemoveScreenshot(entry.msbtFile, i);
                              toast({ title: "🗑️ تم حذف الصورة" });
                            }}
                            className="p-1 rounded bg-red-500/30 hover:bg-red-500/50 transition-colors"
                          >
                            <X className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Zoom overlay */}
      {zoomedUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center cursor-pointer"
          onClick={() => setZoomedUrl(null)}
        >
          <img src={zoomedUrl} alt="zoomed" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={() => setZoomedUrl(null)}
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      )}
    </>
  );
}
