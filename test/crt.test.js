// CRT 核心算法测试：node test/crt.test.js
import { gcd, lcm, extendedGcd, modInverse, mergeCongruence, solveCrt, findIncompatiblePair, analyzePlan } from '../src/crt.js';

let passed = 0;
let failed = 0;

function assert(cond, message) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`✕ ${message}`);
  }
}

function eqBig(actual, expected, message) {
  assert(actual === BigInt(expected), `${message} (期望 ${expected}, 实际 ${actual})`);
}

// ---- gcd / lcm ----
eqBig(gcd(0n, 0n), 0n, 'gcd(0,0)=0');
eqBig(gcd(12n, 18n), 6n, 'gcd(12,18)=6');
eqBig(gcd(-12n, 18n), 6n, 'gcd 负数取绝对值');
eqBig(lcm(4n, 6n), 12n, 'lcm(4,6)=12');
eqBig(lcm(7n, 13n), 91n, 'lcm 互质');

// ---- 扩展欧几里得 / 逆元 ----
{
  const { g, x, y } = extendedGcd(35n, 15n);
  eqBig(g, 5n, 'extgcd g');
  eqBig(35n * x + 15n * y, 5n, 'extgcd 恒等式');
}
eqBig(modInverse(3n, 7n), 5n, '3^-1 mod 7 = 5');
assert(modInverse(2n, 4n) === null, 'gcd≠1 时无逆元');

// ---- 合并同余式 ----
// x ≡ 2 (mod 3), x ≡ 3 (mod 5) -> x ≡ 8 (mod 15)
{
  const m = mergeCongruence(2n, 3n, 3n, 5n);
  eqBig(m.r, 8n, 'CRT merge r');
  eqBig(m.m, 15n, 'CRT merge m');
}
// 不相容：x ≡ 1 (mod 4), x ≡ 0 (mod 2)
assert(mergeCongruence(1n, 4n, 0n, 2n) === null, '不相容合并返回 null');
// 包含关系：x ≡ 0 (mod 6), x ≡ 0 (mod 2) -> x ≡ 0 (mod 6)
{
  const m = mergeCongruence(0n, 6n, 0n, 2n);
  eqBig(m.r, 0n, '包含关系 r');
  eqBig(m.m, 6n, '包含关系 m');
}
// 第一个模数整除第二个（g=m1，如周长 1）：合并结果取第二个同余式
// x ≡ 0 (mod 1), x ≡ 9 (mod 11) -> x ≡ 9 (mod 11)，而非 0
{
  const m = mergeCongruence(0n, 1n, 9n, 11n);
  eqBig(m.r, 9n, 'g=m1 时 r 取 r2');
  eqBig(m.m, 11n, 'g=m1 时 m 取 m2');
  // 三筒完整求解：(1,0),(11,9),(13,8) -> x=86, L=143
  const sol = solveCrt([
    { perimeter: 1n, offset: 0n },
    { perimeter: 11n, offset: 9n },
    { perimeter: 13n, offset: 8n }
  ]);
  assert(sol.solvable, '含周长 1 的案例有解');
  eqBig(sol.firstPosition, 86n, '含周长 1 首次=86');
  eqBig(sol.period, 143n, '含周长 1 周期=143');
}

// ---- 经典案例验证：3 筒，偏移 0,4,2，周长 6,10,8 -> r=114, L=120 ----
// （114 mod 6=0, 114 mod 10=4, 114 mod 8=2；比它小的位置无解）
{
  const rollers = [
    { perimeter: 6n, offset: 0n },
    { perimeter: 10n, offset: 4n },
    { perimeter: 8n, offset: 2n }
  ];
  const sol = solveCrt(rollers);
  assert(sol.solvable, '案例有解');
  eqBig(sol.firstPosition, 114n, '首次对花=114');
  eqBig(sol.period, 120n, '周期=120');
  // 逐筒验证所有位置确实满足条件
  const r = analyzePlan(rollers, 500n);
  for (const x of r.positions) {
    assert(rollers.every(({ perimeter, offset }) => x % perimeter === offset),
      `位置 ${x} 满足全部同余条件`);
  }
  // 114,234,354,474 共 4 个
  eqBig(r.totalInCloth, 4n, '布长 500 内共 4 个点');
  assert(r.positions.length === 4, '返回 4 个点');
  assert(!r.truncated, '未截断');
}

// ---- 全零偏移：首次位置为 0（布头即对花）----
{
  const rollers = [
    { perimeter: 4n, offset: 0n },
    { perimeter: 6n, offset: 0n }
  ];
  const r = analyzePlan(rollers, 12n);
  eqBig(r.firstPosition, 0n, '全零偏移首次=0');
  eqBig(r.period, 12n, '全零偏移周期=lcm');
  eqBig(r.totalInCloth, 2n, '布长 12 内含 0 与 12 共 2 个（含边界）');
}

// ---- 无解：找出互不相容的色筒对（冲突对不涉及第 1 筒）----
{
  // 第 5、6 筒周长同为 19，偏移 15 与 9，差 6 不能被 19 整除
  const rollers = [
    { perimeter: 11n, offset: 2n },
    { perimeter: 17n, offset: 1n },
    { perimeter: 3n, offset: 1n },
    { perimeter: 13n, offset: 5n },
    { perimeter: 19n, offset: 15n },
    { perimeter: 19n, offset: 9n }
  ];
  const sol = solveCrt(rollers);
  assert(!sol.solvable, '6 筒案例无解');
  assert(sol.incompatiblePair.a === 4 && sol.incompatiblePair.b === 5,
    '不相容对为第 5、6 筒（不能误报第 1 筒）');
  const pair = findIncompatiblePair(rollers);
  assert(pair.a === 4 && pair.b === 5, 'findIncompatiblePair 定位正确');
}

// ---- 无解：找出互不相容的色筒对（第 1 筒确实与后续筒冲突的简单情形）----
{
  const rollers = [
    { perimeter: 6n, offset: 0n },   // 第1筒
    { perimeter: 10n, offset: 4n },  // 第2筒
    { perimeter: 8n, offset: 3n }    // 第3筒：偏移 3 与第1筒 gcd 2 不相容
  ];
  const sol = solveCrt(rollers);
  assert(!sol.solvable, '案例无解');
  assert(sol.incompatiblePair.a === 0 && sol.incompatiblePair.b === 2,
    '不相容对为第 1、3 筒');
  const r = analyzePlan(rollers, 1000n);
  assert(!r.solvable && r.positions.length === 0, '无解时无位置列表');
  eqBig(r.incompatiblePair.gcd, 2n, '不相容对 gcd=2');
}

// ---- 另一组不相容：周长 4/6，偏移 1/0（差 1 不能被 gcd 2 整除）----
{
  const sol = solveCrt([
    { perimeter: 4n, offset: 1n },
    { perimeter: 6n, offset: 0n }
  ]);
  assert(!sol.solvable, '4/6 偏移 1/0 无解');
}

// ---- 超大整数（远超 2^53）----
{
  // 周长 10^20 与 3*10^20，偏移同为 12345678901234567890
  // gcd=10^20 整除偏移差 0，有解；r=偏移，L=3*10^20
  const P = '100000000000000000000'; // 1e20
  const Q = '300000000000000000000'; // 3e20
  const OFF = '12345678901234567890';
  const rollers = [
    { perimeter: BigInt(P), offset: BigInt(OFF) },
    { perimeter: BigInt(Q), offset: BigInt(OFF) }
  ];
  const sol = solveCrt(rollers);
  assert(sol.solvable, '超大整数有解');
  eqBig(sol.firstPosition, BigInt(OFF), '超大整数首次位置精确');
  eqBig(sol.period, BigInt(Q), '超大整数周期精确');
}

// ---- 互质大素数场景 ----
{
  // 1000003 与 1000033 均为素数；x ≡ 7 (mod p1), x ≡ 11 (mod p2)
  const p1 = 1000003n;
  const p2 = 1000033n;
  const sol = solveCrt([
    { perimeter: p1, offset: 7n },
    { perimeter: p2, offset: 11n }
  ]);
  assert(sol.solvable, '大素数场景有解');
  eqBig(sol.period, p1 * p2, '周期为两素数之积');
  eqBig(sol.firstPosition % p1, 7n, '解满足同余式 1');
  eqBig(sol.firstPosition % p2, 11n, '解满足同余式 2');
}

// ---- 布长截断：只返回前 20 个，totalInCloth 用公式精确统计 ----
{
  const rollers = [
    { perimeter: 2n, offset: 0n },
    { perimeter: 3n, offset: 0n }
  ]; // 周期 6，位置 0,6,12,...
  const cloth = '1000000000000000000000'; // 1e21
  const r = analyzePlan(rollers, BigInt(cloth));
  assert(r.positions.length === 20, '超长布长只返回 20 个点');
  assert(r.truncated, '标记为已截断');
  eqBig(r.totalInCloth, BigInt(cloth) / 6n + 1n, '总数精确（大整数除法）');
  eqBig(r.positions[19], 114n, '第 20 个点为 114');
}

// ---- 布长不足：首次位置超出布长 ----
{
  const rollers = [
    { perimeter: 6n, offset: 0n },
    { perimeter: 10n, offset: 4n }
  ]; // r=24, L=30
  const r = analyzePlan(rollers, 23n);
  eqBig(r.totalInCloth, 0n, '布内 0 个点');
  assert(r.positions.length === 0, '位置列表为空');
  const r2 = analyzePlan(rollers, 24n);
  eqBig(r2.totalInCloth, 1n, '恰好在边界=1 个点（含端点）');
}

// ---- 8 个色筒（上限）----
{
  const rollers = [];
  for (let i = 0; i < 8; i++) rollers.push({ perimeter: BigInt(i + 2), offset: 0n });
  const sol = solveCrt(rollers);
  assert(sol.solvable, '8 筒全零有解');
  eqBig(sol.firstPosition, 0n, '8 筒首次=0');
  // lcm(2..9) = 2520
  eqBig(sol.period, 2520n, 'lcm(2..9)=2520');
}

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed === 0 ? 0 : 1);
