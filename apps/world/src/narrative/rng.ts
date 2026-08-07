// splitmix32: pure. seed in, {value, seed} out. NEVER call Math.random from
// this module — see reduce.ts's purity contract.
export function nextRng(seed: number): { value: number; seed: number } {
  let z = (seed + 0x9e3779b9) | 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  const value = ((z ^ (z >>> 15)) >>> 0) / 4294967296;
  return { value, seed: z | 0 };
}
