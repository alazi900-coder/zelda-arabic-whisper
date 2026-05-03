/**
 * Word-level LCS diff producing an array of segments tagged "same" | "del" | "add".
 * Whitespace is preserved so RTL Arabic text wraps correctly.
 */
export function diffWords(
  a: string,
  b: string,
): { type: "same" | "del" | "add"; text: string }[] {
  const aw = a.split(/(\s+)/);
  const bw = b.split(/(\s+)/);
  const m = aw.length;
  const n = bw.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = aw[i] === bw[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: { type: "same" | "del" | "add"; text: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (aw[i] === bw[j]) {
      out.push({ type: "same", text: aw[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: aw[i] });
      i++;
    } else {
      out.push({ type: "add", text: bw[j] });
      j++;
    }
  }
  while (i < m) out.push({ type: "del", text: aw[i++] });
  while (j < n) out.push({ type: "add", text: bw[j++] });
  return out;
}
