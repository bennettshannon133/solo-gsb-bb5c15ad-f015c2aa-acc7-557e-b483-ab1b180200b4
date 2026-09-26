/**
 * crt.js —— 多色滚筒套准（广义中国剩余定理 / 同余合并）
 *
 * 模型：色筒 i 的重复周长为 p_i，标记偏移为 a_i（0 ≤ a_i < p_i）。
 * 标记在布面上出现的位置 x 满足：
 *
 *     x ≡ a_i (mod p_i)
 *
 * 全部色筒同时对花 ⇔ 该同余方程组有解。
 *
 * 有解时：
 *   - firstPosition 为布头 0 mm 起的最小非负解；
 *   - period 为共同重复周期，即所有周长的最小公倍数 LCM(p_1,…,p_n)；
 *   - 之后所有对花位置为 firstPosition + k·period（k 为非负整数）。
 *
 * 无解时，至少存在一对色筒 i,j 互不相容：
 *   gcd(p_i, p_j) 不能整除 (a_i − a_j)，接口返回这样的一对作为证据。
 *
 * 全部计算使用 BigInt，整数位数不受 JavaScript Number 安全整数范围限制。
 */

/** 非负取模（BigInt）。 */
export function bigMod(a, m) {
  return ((a % m) + m) % m;
}

/** 最大公约数（BigInt，结果非负）。 */
export function bigGcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

/** 最小公倍数（BigInt，入参均为正）。 */
export function bigLcm(a, b) {
  return (a / bigGcd(a, b)) * b;
}

/**
 * 扩展欧几里得：求 (g, x, y) 使 a·x + b·y = g = gcd(a,b)。
 */
function extendedGcd(a, b) {
  if (b === 0n) {
    return { g: a < 0n ? -a : a, x: a < 0n ? -1n : 1n, y: 0n };
  }
  const { g, x, y } = extendedGcd(b, a % b);
  return { g, x: y, y: x - (a / b) * y };
}

/**
 * 判定同余组 a（模 m）与 b（模 n）是否相容。
 * 相容条件：gcd(m, n) 整除 (a − b)。
 */
export function isCompatible(a, m, b, n) {
  const g = bigGcd(m, n);
  return bigMod(a - b, g) === 0n;
}

/**
 * 合并两条同余：x ≡ a1 (mod m1) 与 x ≡ a2 (mod m2)。
 * 调用前必须保证二者相容（isCompatible）。
 *
 * 合并结果：x ≡ r (mod lcm(m1,m2))，r 取最小非负代表元。
 */
export function mergeCongruence(a1, m1, a2, m2) {
  const g = bigGcd(m1, m2);
  const m = bigLcm(m1, m2);

  // 解 k：m1·k ≡ (a2 − a1) (mod m2)
  // 令 M1 = m1/g，M2 = m2/g，diff = (a2-a1)/g
  // M1·k ≡ diff (mod M2)，gcd(M1, M2) = 1，可求逆元。
  const M1 = m1 / g;
  const M2 = m2 / g;
  const diff = ((a2 - a1) / g) % (M2 === 0n ? 1n : M2);

  let k;
  if (M2 === 1n) {
    k = 0n;
  } else {
    const { x } = extendedGcd(M1 % M2, M2);
    k = bigMod(diff * x, M2);
  }

  const r = bigMod(a1 + m1 * k, m);
  return { a: r, m };
}

/**
 * 求解一个套准方案。
 *
 * @param {Array<{perimeter: bigint, offset: bigint}>} rollers 2～8 个色筒
 * @returns 结果对象（字段均为 bigint / 索引 / 数组）：
 *   {
 *     solvable: true,
 *     firstPosition: bigint,         // 布头起首次对花位置（mm）
 *     period: bigint,                // 共同重复周期（mm）
 *   }
 *   或
 *   {
 *     solvable: false,
 *     conflict: { i, j, gcd, diff }  // 一对互不相容的色筒（0 基索引）
 *   }
 */
export function solve(rollers) {
  // 第一步：两两扫描，找出一对互不相容的色筒（天然满足“指出一对”）。
  for (let i = 0; i < rollers.length; i++) {
    for (let j = i + 1; j < rollers.length; j++) {
      const ri = rollers[i];
      const rj = rollers[j];
      if (!isCompatible(ri.offset, ri.perimeter, rj.offset, rj.perimeter)) {
        return {
          solvable: false,
          conflict: {
            i,
            j,
            gcd: bigGcd(ri.perimeter, rj.perimeter),
            diff: ri.offset - rj.offset,
          },
        };
      }
    }
  }

  // 第二步：依次合并全部同余。
  let acc = { a: rollers[0].offset, m: rollers[0].perimeter };
  for (let k = 1; k < rollers.length; k++) {
    acc = mergeCongruence(
      acc.a,
      acc.m,
      rollers[k].offset,
      rollers[k].perimeter
    );
  }

  return { solvable: true, firstPosition: acc.a, period: acc.m };
}

/**
 * 列出不超过布长的最早若干个对花位置（含 0 mm 与布长端点）。
 *
 * @param {bigint} firstPosition 首次对花位置
 * @param {bigint} period        共同重复周期
 * @param {bigint} clothLength   布长（mm，非负）
 * @param {number} limit         最多返回个数（默认 20）
 * @returns {{ positions: bigint[], total: bigint }}
 *   positions 为最早的 limit 个（不足则全部）；total 为布长内总个数。
 */
export function positionsWithinCloth(firstPosition, period, clothLength, limit = 20) {
  const positions = [];
  if (firstPosition <= clothLength) {
    // x_k = first + k·period ≤ clothLength
    // total = floor((clothLength − first)/period) + 1
    const total = (clothLength - firstPosition) / period + 1n;
    let x = firstPosition;
    for (let k = 0; k < limit && x <= clothLength; k++) {
      positions.push(x);
      x += period;
    }
    return { positions, total };
  }
  return { positions, total: 0n };
}
