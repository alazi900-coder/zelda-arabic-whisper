import { describe, it, expect } from "vitest";
import {
  summarizeCategories,
  categoryOfKey,
} from "@/lib/category-summary";

describe("categoryOfKey", () => {
  it("detects EventFlowMsg as story", () => {
    expect(categoryOfKey("EventFlowMsg/Npc_RitoHatago004.msbt:12")).toBe("story");
  });
  it("detects StaticMsg as tips", () => {
    expect(categoryOfKey("StaticMsg/Buff.msbt:0")).toBe("tips");
  });
  it("detects LayoutMsg/TreasureFullShortCut as hud", () => {
    expect(categoryOfKey("LayoutMsg/TreasureFullShortCut_00.msbt:0")).toBe("hud");
  });
  it("detects LayoutMsg/Pause as pause-menu", () => {
    expect(categoryOfKey("LayoutMsg/PauseMenu.msbt:0")).toBe("pause-menu");
  });
  it("detects LayoutMsg/Title as main-menu", () => {
    expect(categoryOfKey("LayoutMsg/Title.msbt:0")).toBe("main-menu");
  });
  it("detects NpcTerrorMsg as other (not Npc.msbt)", () => {
    // NpcTerrorMsg is a different folder; falls through to other.
    expect(categoryOfKey("NpcTerrorMsg/NPC_Goron_X.msbt:45")).toBe("other");
  });
  it("returns 'other' for unknown paths", () => {
    expect(categoryOfKey("Unknown/Foo.msbt:0")).toBe("other");
  });
  it("handles keys without a colon gracefully", () => {
    expect(categoryOfKey("just-a-key")).toBe("other");
  });
});

describe("summarizeCategories", () => {
  const sample = [
    { key: "EventFlowMsg/A.msbt:0" },
    { key: "EventFlowMsg/A.msbt:1" },
    { key: "StaticMsg/Buff.msbt:0" },
    { key: "StaticMsg/Buff.msbt:1" },
    { key: "LayoutMsg/Title.msbt:0" },
    { key: "Unknown/Foo.msbt:0" },
  ];

  it("counts entries per category", () => {
    const s = summarizeCategories(sample);
    expect(s["story"].total).toBe(2);
    expect(s["tips"].total).toBe(2);
    expect(s["main-menu"].total).toBe(1);
    expect(s["other"].total).toBe(1);
  });

  it("counts withIssues only when key is in the issue set", () => {
    const issues = new Set([
      "EventFlowMsg/A.msbt:0",
      "StaticMsg/Buff.msbt:0",
      "Unknown/Foo.msbt:0",
    ]);
    const s = summarizeCategories(sample, issues);
    expect(s["story"].withIssues).toBe(1);
    expect(s["tips"].withIssues).toBe(1);
    expect(s["main-menu"].withIssues).toBe(0);
    expect(s["other"].withIssues).toBe(1);
  });
});
