/**
 * math.test.js —— CRT / BigInt 核心算法的零依赖断言测试
 * 运行：npm test
 */

import assert from 'node:assert/strict';
import {
  bigMod,
  bigGcd,
  bigLcm,
  isCompatible,
  mergeCongruence,
  solve,
  positionsWithinCloth,
} from '../lib/crt.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

const r = (perimeter, offset) => ({ perimeter: BigInt(perimeter), offset: BigInt(offset) });

test('bigMod 非负取模', () => {
  assert.equal(bigMod(-10n, 6n), 2n);
  assert.equal(bigMod(10n, 6n), 4n);
  assert.equal(bigMod(0n, 7n), 0n);
});

test('gcd / lcm', () => {
  assert.equal(bigGcd(640n, 800n), 160n);
  assert.equal(bigLcm(640n, 800n), 3200n);
  assert.equal(bigLcm(6n, 10n), 30n);
});

test('相容性判定：偏移差必须被 gcd 整除', () => {
  assert.equal(isCompatible(2n, 6n, 4n, 8n), true);   // gcd=2, diff=-2
  assert.equal(isCompatible(0n, 6n, 3n, 4n), false);  // gcd(6,4)=2 不整除 -3
});

test('合并同余 x≡2(mod 6), x≡4(mod 8) => x≡20(mod 24)', () => {
  const m = mergeCongruence(2n, 6n, 4n, 8n);
  assert.equal(m.a, 20n);
  assert.equal(m.m, 24n);
  // 20 同时满足两式：20%6=2，20%8=4
  assert.equal(20n % 6n, 2n);
  assert.equal(20n % 8n, 4n);
});

test('经典 CRT：互质模数', () => {
  const out = solve([r(3, 2), r(5, 3), r(7, 2)]);
  assert.equal(out.solvable, true);
  assert.equal(out.firstPosition, 23n);
  assert.equal(out.period, 105n);
});

test('偏移全 0：首次位置 0，周期为 LCM', () => {
  const out = solve([r(640, 0), r(800, 0), r(900, 0)]);
  assert.equal(out.solvable, true);
  assert.equal(out.firstPosition, 0n);
  assert.equal(out.period, bigLcm(bigLcm(640n, 800n), 900n));
  assert.equal(out.period, 28800n);
});

test('无解：返回一对互不相容色筒及证据', () => {
  const out = solve([r(6, 0), r(4, 3), r(9, 5)]);
  assert.equal(out.solvable, false);
  assert.equal(out.conflict.i, 0);
  assert.equal(out.conflict.j, 1);
  assert.equal(out.conflict.gcd, 2n);
});

test('三个色筒的相容解：x≡1(mod 6), x≡4(mod 9), x≡7(mod 15)', () => {
  const out = solve([r(6, 1), r(9, 4), r(15, 7)]);
  assert.equal(out.solvable, true);
  // 解 x≡? (mod 90)，校验 x=22: 22%6=4 ≠1；实际最小解需满足：
  // x≡1 mod6, x≡4 mod9 -> gcd3 |3，合并得 x≡13 mod18；
  // 与 x≡7 mod15：gcd(18,15)=3，13-7=6 可整除 => x≡67 mod90
  assert.equal(out.firstPosition, 67n);
  assert.equal(out.period, 90n);
});

test('超大整数：超过 Number.MAX_SAFE_INTEGER', () => {
  // 两个 ~30 位的“近似质数级”周长，偏移全 0，周期 = 乘积
  const p1 = 123456789012345678901234567891n;
  const p2 = 987654321098765432109876543211n;
  const out = solve([r(p1, 0n), r(p2, 0n)]);
  assert.equal(out.solvable, true);
  assert.equal(out.firstPosition, 0n);
  assert.equal(out.period, p1 * p2);
  // 结果远超 2^53，仍精确
  assert.ok(out.period > BigInt(Number.MAX_SAFE_INTEGER));
});

test('超大整数：非零偏移的广义 CRT', () => {
  // 构造解 X，令 p1=大质数A，p2=大质数B，偏移 = X mod p
  const p1 = 1000000007n; // 质数
  const p2 = 1000000009n; // 质数
  const X = 9007199254740993n; // 2^53+1，超出安全整数
  const a1 = X % p1;
  const a2 = X % p2;
  const out = solve([r(p1, a1), r(p2, a2)]);
  assert.equal(out.solvable, true);
  assert.equal(out.firstPosition, X);
  assert.equal(out.period, p1 * p2);
});

test('positionsWithinCloth：分页与总数', () => {
  // first=10, period=24，布长 100：10,34,58,82 -> 4 个
  const out = positionsWithinCloth(10n, 24n, 100n, 20);
  assert.deepEqual(out.positions, [10n, 34n, 58n, 82n]);
  assert.equal(out.total, 4n);

  // limit=2 时只取前两个，但 total 不变
  const out2 = positionsWithinCloth(10n, 24n, 100n, 2);
  assert.deepEqual(out2.positions, [10n, 34n]);
  assert.equal(out2.total, 4n);

  // 首次对花已超过布长
  const out3 = positionsWithinCloth(200n, 24n, 100n, 20);
  assert.deepEqual(out3.positions, []);
  assert.equal(out3.total, 0n);

  // 布长恰好等于某个对花点（端点包含）
  const out4 = positionsWithinCloth(0n, 100n, 250n, 20);
  assert.deepEqual(out4.positions, [0n, 100n, 200n]);
  assert.equal(out4.total, 3n);
});

console.log(`\n全部 ${passed} 项测试通过 ✔\n`);
