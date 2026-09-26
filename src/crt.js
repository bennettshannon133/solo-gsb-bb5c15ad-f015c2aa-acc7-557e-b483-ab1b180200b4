// 多色滚筒套准计算核心 —— 广义中国剩余定理（BigInt 实现，无精度上限）
//
// 每个色筒 i 的标记位置（从布头 0 mm 起）满足：
//     x ≡ offset_i (mod perimeter_i)
// 求所有色筒同时对花的位置，等价于求解同余方程组。
//   - 有解：首次对花位置 r（最小非负解），共同重复周期 L = lcm(所有周长)
//   - 无解：存在一对色筒 (a,b)，其偏移差不能被 gcd(周长) 整除，二者互不相容
//
// 合并两个同余式 x ≡ r1 (mod m1) 与 x ≡ r2 (mod m2)：
//   可解条件：(r2 - r1) 能被 g = gcd(m1, m2) 整除
//   合并后：x ≡ r (mod lcm(m1, m2))

/**
 * 最大公约数（迭代实现，避免极深递归）
 */
export function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * 最小公倍数
 */
export function lcm(a, b) {
  const g = gcd(a, b);
  return g === 0n ? 0n : (a / g) * b;
}

/**
 * 扩展欧几里得算法：返回 { g, x, y }，使 a*x + b*y = g = gcd(a,b)
 */
export function extendedGcd(a, b) {
  let oldR = a;
  let r = b;
  let oldS = 1n;
  let s = 0n;
  let oldT = 0n;
  let t = 1n;
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
    [oldT, t] = [t, oldT - q * t];
  }
  return { g: oldR, x: oldS, y: oldT };
}

/**
 * 求 a 在模 m 下的乘法逆元（要求 gcd(a,m)=1），结果归一化到 [0,m)
 */
export function modInverse(a, m) {
  const { g, x } = extendedGcd(((a % m) + m) % m, m);
  if (g !== 1n) return null;
  return ((x % m) + m) % m;
}

/**
 * 合并两个同余式：
 *   x ≡ r1 (mod m1)
 *   x ≡ r2 (mod m2)
 * 成功返回 { r, m }（r 已归一化到 [0,m)，m = lcm(m1,m2)），
 * 不相容返回 null。
 */
export function mergeCongruence(r1, m1, r2, m2) {
  const g = gcd(m1, m2);
  const diff = r2 - r1;
  // 可解条件：g | (r2 - r1)
  if (((diff % g) + g) % g !== 0n) return null;

  const m = (m1 / g) * m2; // lcm(m1, m2)
  const m1g = m1 / g;
  const m2g = m2 / g;
  // diff/g ≡ k * (m1/g) (mod m2/g)，求 k。
  // 约去 gcd 后 gcd(m1/g, m2/g)=1，逆元恒存在；
  // 退化情形（m1|m2 时 m1/g=1，逆元为 1）也由此统一处理，无需特判。
  const inv = modInverse(m1g, m2g);
  let k = (((diff / g) % m2g) + m2g) % m2g * inv % m2g;
  const r = (((r1 + m1 * k) % m) + m) % m;
  return { r, m };
}

/**
 * 在全部色筒中查找一对互不相容的色筒（O(n²)，n≤8 可忽略）。
 * 广义 CRT 的两两相容性定理：方程组有解，当且仅当任意两筒都满足
 * gcd(p_a,p_b) | (offset_b - offset_a)。
 * @returns {{a:number,b:number}|null} 下标从 0 开始
 */
export function findIncompatiblePair(rollers) {
  for (let a = 0; a < rollers.length; a++) {
    for (let b = a + 1; b < rollers.length; b++) {
      const g = gcd(rollers[a].perimeter, rollers[b].perimeter);
      const diff = rollers[b].offset - rollers[a].offset;
      if (((diff % g) + g) % g !== 0n) {
        return { a, b };
      }
    }
  }
  return null;
}

/**
 * 求解广义 CRT。
 * @param {Array<{perimeter: bigint, offset: bigint}>} rollers
 * @returns {{
 *   solvable: true, firstPosition: bigint, period: bigint
 * } | {
 *   solvable: false, incompatiblePair: {a: number, b: number}
 * }}
 * 色筒下标 a/b 从 0 开始。
 */
export function solveCrt(rollers) {
  let r = rollers[0].offset % rollers[0].perimeter;
  let m = rollers[0].perimeter;

  for (let i = 1; i < rollers.length; i++) {
    const next = rollers[i];
    const ri = next.offset % next.perimeter;
    const mi = next.perimeter;
    const merged = mergeCongruence(r, m, ri, mi);
    if (merged === null) {
      // 迭代合并失败 ⇒ 必存在某对两两不相容的色筒（两两相容性定理）
      const pair = findIncompatiblePair(rollers) || { a: 0, b: i };
      return { solvable: false, incompatiblePair: pair };
    }
    r = merged.r;
    m = merged.m;
  }
  return { solvable: true, firstPosition: r, period: m };
}

/**
 * 对一个完整方案执行套准分析。
 * @param {{perimeter: bigint, offset: bigint}[]} rollers 2~8 个色筒
 * @param {bigint} clothLength 布长（非负）
 * @returns {object} 分析结果（数值均为 BigInt，由调用方序列化）
 */
export function analyzePlan(rollers, clothLength) {
  const solution = solveCrt(rollers);

  if (!solution.solvable) {
    const { a, b } = solution.incompatiblePair;
    return {
      solvable: false,
      rollerCount: rollers.length,
      incompatiblePair: {
        a,
        b,
        perimeterA: rollers[a].perimeter,
        offsetA: rollers[a].offset,
        perimeterB: rollers[b].perimeter,
        offsetB: rollers[b].offset,
        gcd: gcd(rollers[a].perimeter, rollers[b].perimeter)
      },
      positions: []
    };
  }

  const { firstPosition, period } = solution;
  const positions = [];
  let totalInCloth = 0n;
  let x = firstPosition;

  // 只需要前 20 个；totalInCloth 单独用除法统计，避免超长布长下循环
  if (x <= clothLength) {
    totalInCloth = (clothLength - x) / period + 1n;
    while (x <= clothLength && positions.length < 20) {
      positions.push(x);
      x += period;
    }
  }

  return {
    solvable: true,
    rollerCount: rollers.length,
    firstPosition,
    period,
    totalInCloth,
    truncated: totalInCloth > 20n,
    positions
  };
}
