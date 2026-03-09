import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle2, AlertTriangle, Tag, Eye, EyeOff } from "lucide-react";

interface EditorStatsCardsProps {
  totalEntries: number;
  translatedCount: number;
  qualityTotal: number;
  protectedCount: number;
  showQualityStats: boolean;
  setShowQualityStats: (v: boolean) => void;
  isMobile: boolean;
}

const EditorStatsCards: React.FC<EditorStatsCardsProps> = ({
  totalEntries, translatedCount, qualityTotal, protectedCount,
  showQualityStats, setShowQualityStats, isMobile,
}) => (
  <div className="flex flex-wrap items-center gap-3 md:gap-4">
    <Card className="flex-1 min-w-[100px]">
      <CardContent className="flex items-center gap-2 md:gap-3 p-3 md:p-4">
        <FileText className="w-4 h-4 md:w-5 md:h-5 text-primary" />
        <div>
          <p className="text-base md:text-lg font-display font-bold">{totalEntries}</p>
          <p className="text-[10px] md:text-xs text-muted-foreground">إجمالي النصوص</p>
        </div>
      </CardContent>
    </Card>
    <Card className="flex-1 min-w-[100px]">
      <CardContent className="flex items-center gap-2 md:gap-3 p-3 md:p-4">
        <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-secondary" />
        <div>
          <p className="text-base md:text-lg font-display font-bold">{translatedCount}</p>
          <p className="text-[10px] md:text-xs text-muted-foreground">مترجم</p>
        </div>
      </CardContent>
    </Card>
    {!isMobile && (
      <>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-lg font-display font-bold">{qualityTotal}</p>
              <p className="text-xs text-muted-foreground">مشاكل جودة</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowQualityStats(!showQualityStats)} className="ml-auto text-xs">
              {showQualityStats ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="flex items-center gap-3 p-4">
            <Tag className="w-5 h-5 text-accent" />
            <div>
              <p className="text-lg font-display font-bold">{protectedCount} / {totalEntries}</p>
              <p className="text-xs text-muted-foreground">محمي من العكس</p>
            </div>
          </CardContent>
        </Card>
      </>
    )}
  </div>
);

export default React.memo(EditorStatsCards);
