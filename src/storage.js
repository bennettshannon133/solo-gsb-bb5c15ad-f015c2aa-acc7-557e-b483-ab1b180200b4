// 方案持久化：全部方案保存在一个本地 JSON 文件中。
// 写入采用“临时文件 + rename”原子替换，避免并发请求写坏文件。

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || '/data';
const FILE_PATH = path.join(DATA_DIR, 'plans.json');

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE_PATH);
  } catch {
    await fs.writeFile(FILE_PATH, JSON.stringify({ plans: [] }, null, 2), 'utf8');
  }
}

/**
 * @returns {Promise<Array<{id: string, name: string, clothLength: string,
 *   rollers: Array<{perimeter: string, offset: string}>, createdAt: string, updatedAt: string}>>}
 */
export async function listPlans() {
  await ensureStore();
  const raw = await fs.readFile(FILE_PATH, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // 文件损坏时不自动清空，防止误操作丢数据；交由运维处理
    throw new Error(`方案存储文件解析失败：${FILE_PATH}`);
  }
  return Array.isArray(parsed.plans) ? parsed.plans : [];
}

export async function getPlan(id) {
  const plans = await listPlans();
  return plans.find((p) => p.id === id) || null;
}

/**
 * 将已校验的方案数据落盘。
 * @param {string|null} id 为 null 表示新建
 * @param {{name: string, clothLengthRaw: string,
 *   rollers: Array<{perimeterRaw: string, offsetRaw: string}>}} data
 */
export async function savePlan(id, data) {
  const plans = await listPlans();
  const now = new Date().toISOString();

  if (id === null) {
    const record = {
      id: randomUUID(),
      name: data.name,
      clothLength: data.clothLengthRaw,
      rollers: data.rollers.map((r) => ({
        perimeter: r.perimeterRaw,
        offset: r.offsetRaw
      })),
      createdAt: now,
      updatedAt: now
    };
    plans.push(record);
    await writePlans(plans);
    return record;
  }

  const index = plans.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const record = {
    ...plans[index],
    name: data.name,
    clothLength: data.clothLengthRaw,
    rollers: data.rollers.map((r) => ({
      perimeter: r.perimeterRaw,
      offset: r.offsetRaw
    })),
    updatedAt: now
  };
  plans[index] = record;
  await writePlans(plans);
  return record;
}

export async function deletePlan(id) {
  const plans = await listPlans();
  const next = plans.filter((p) => p.id !== id);
  if (next.length === plans.length) return false;
  await writePlans(next);
  return true;
}

async function writePlans(plans) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ plans }, null, 2), 'utf8');
  await fs.rename(tmp, FILE_PATH);
}
