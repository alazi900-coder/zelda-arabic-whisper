import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TooltipProvider } from "@/components/ui/tooltip";
import { displayOriginal } from "@/components/editor/types";

/**
 * Snapshot/structural test: PUA tag rendering must use dir="ltr" + unicode-bidi:isolate
 * so the badge stays in the same logical position regardless of the surrounding
 * RTL/LTR direction of the host (editor input vs. DiffView panel).
 */
describe("PUA display alignment between editor and DiffView", () => {
  const renderIn = (dir: "rtl" | "ltr", text: string) =>
    renderToStaticMarkup(
      React.createElement(
        TooltipProvider,
        null,
        React.createElement("div", { dir }, displayOriginal(text) as React.ReactNode),
      ),
    );

  it("renders PUA tags with isolate bidi so order matches across containers", () => {
    const text = "Hello \uE000 world \uE001!";
    const rtl = renderIn("rtl", text);
    const ltr = renderIn("ltr", text);
    // Both contexts must keep the same number of PUA badges
    expect((rtl.match(/🏷/g) || []).length).toBe(2);
    expect((ltr.match(/🏷/g) || []).length).toBe(2);
    // And both must include the bidi-isolate wrapper
    expect(rtl).toContain("unicode-bidi:isolate");
    expect(ltr).toContain("unicode-bidi:isolate");
    expect(rtl).toContain('dir="ltr"');
    expect(ltr).toContain('dir="ltr"');
  });

  it("renders legacy FFF9-FFFB markers with the same isolate wrapper", () => {
    const html = renderIn("rtl", "ABC \uFFF9 خ \uFFFB");
    expect(html).toContain("unicode-bidi:isolate");
    expect(html).toContain('dir="ltr"');
  });
});
