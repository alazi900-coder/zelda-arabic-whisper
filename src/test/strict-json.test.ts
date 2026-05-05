import { describe, it, expect } from "vitest";

// These tests cover the *client-side* contract of the strict-JSON feature (#24).
// The actual tool-calling logic lives in the Deno edge function and is tested
// out-of-process. The client only owns:
//   1. localStorage persistence of the toggle (default: true)
//   2. Wire format: a `strictJson` boolean field on the request body
//   3. Default-when-unset behavior on the server (treats absent or non-false
//      as ON — captured by `strictJson !== false`)
//
// We mirror those rules with simple pure helpers so we can assert them.

// --- Helpers under test ---

// Mirrors the localStorage logic in useEditorState. Default ON; "0" disables.
function readStrictJsonFromStorage(get: (k: string) => string | null): boolean {
  const raw = get("userStrictJson");
  if (raw === null) return true;
  return raw === "1" || raw === "true";
}

// Mirrors the body-builder pattern used at all 5 translate-entries call sites.
// The callsite passes `strictJson: userStrictJson !== false` so an undefined
// value still enables strict mode (matches edge-function default).
function bodyStrictJsonValue(userStrictJson: boolean | undefined): boolean {
  return userStrictJson !== false;
}

// --- Tests ---

describe("strict JSON tool-calling toggle (#24)", () => {
  describe("localStorage persistence", () => {
    it("defaults to true when no value is stored", () => {
      const fakeStorage = new Map<string, string>();
      const result = readStrictJsonFromStorage((k) => fakeStorage.get(k) ?? null);
      expect(result).toBe(true);
    });

    it("returns true when explicitly set to '1'", () => {
      const fakeStorage = new Map<string, string>([["userStrictJson", "1"]]);
      const result = readStrictJsonFromStorage((k) => fakeStorage.get(k) ?? null);
      expect(result).toBe(true);
    });

    it("returns true when set to 'true' (legacy format)", () => {
      const fakeStorage = new Map<string, string>([["userStrictJson", "true"]]);
      const result = readStrictJsonFromStorage((k) => fakeStorage.get(k) ?? null);
      expect(result).toBe(true);
    });

    it("returns false when explicitly set to '0'", () => {
      const fakeStorage = new Map<string, string>([["userStrictJson", "0"]]);
      const result = readStrictJsonFromStorage((k) => fakeStorage.get(k) ?? null);
      expect(result).toBe(false);
    });

    it("returns false when set to 'false' (legacy format)", () => {
      const fakeStorage = new Map<string, string>([["userStrictJson", "false"]]);
      const result = readStrictJsonFromStorage((k) => fakeStorage.get(k) ?? null);
      expect(result).toBe(false);
    });

    it("returns false for any unknown value (defensive)", () => {
      const fakeStorage = new Map<string, string>([["userStrictJson", "yes"]]);
      const result = readStrictJsonFromStorage((k) => fakeStorage.get(k) ?? null);
      expect(result).toBe(false);
    });
  });

  describe("request body builder", () => {
    it("sends strictJson=true when the user enabled the toggle", () => {
      expect(bodyStrictJsonValue(true)).toBe(true);
    });

    it("sends strictJson=false when the user explicitly disabled the toggle", () => {
      expect(bodyStrictJsonValue(false)).toBe(false);
    });

    it("sends strictJson=true when prop is undefined (default-on contract)", () => {
      // This is the key invariant: a fresh user with no localStorage value
      // and a hook that hasn't received the prop yet still gets strict mode.
      expect(bodyStrictJsonValue(undefined)).toBe(true);
    });
  });

  describe("server-side default contract", () => {
    // Mirrors the edge function's `rawStrictJson !== false` rule. A request
    // body with no field, or with the field set to true, both produce ON.
    // Only an explicit `false` disables it.
    function serverResolveStrictJson(rawStrictJson: unknown): boolean {
      return rawStrictJson !== false;
    }

    it("treats absent field as enabled", () => {
      expect(serverResolveStrictJson(undefined)).toBe(true);
    });

    it("treats null as enabled (per JSON null != false)", () => {
      expect(serverResolveStrictJson(null)).toBe(true);
    });

    it("treats explicit true as enabled", () => {
      expect(serverResolveStrictJson(true)).toBe(true);
    });

    it("treats explicit false as disabled", () => {
      expect(serverResolveStrictJson(false)).toBe(false);
    });
  });
});
