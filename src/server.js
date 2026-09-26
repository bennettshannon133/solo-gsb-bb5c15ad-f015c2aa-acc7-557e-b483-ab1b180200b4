// 多色滚筒套准校核 —— HTTP 服务
// 启动：node src/server.js
// 环境变量：
//   PORT      监听端口（默认 3000）
//   HOST      监听地址（默认 0.0.0.0）
//   DATA_DIR  方案 JSON 存储目录（默认 /data）

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePlan } from './validation.js';
import { analyzePlan } from './crt.js';
import { listPlans, getPlan, savePlan, deletePlan } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// 方案列表
app.get('/api/plans', async (_req, res, next) => {
  try {
    const plans = await listPlans();
    res.json({ plans });
  } catch (err) {
    next(err);
  }
});

// 单个方案
app.get('/api/plans/:id', async (req, res, next) => {
  try {
    const plan = await getPlan(req.params.id);
    if (!plan) return res.status(404).json({ error: '方案不存在' });
    res.json({ plan });
  } catch (err) {
    next(err);
  }
});

// 新建方案
app.post('/api/plans', async (req, res, next) => {
  try {
    const { valid, errors, data } = validatePlan(req.body);
    if (!valid) return res.status(400).json({ error: '输入校验未通过', errors });
    const record = await savePlan(null, data);
    res.status(201).json({ plan: record });
  } catch (err) {
    next(err);
  }
});

// 修改方案
app.put('/api/plans/:id', async (req, res, next) => {
  try {
    const existing = await getPlan(req.params.id);
    if (!existing) return res.status(404).json({ error: '方案不存在' });
    const { valid, errors, data } = validatePlan(req.body);
    if (!valid) return res.status(400).json({ error: '输入校验未通过', errors });
    const record = await savePlan(existing.id, data);
    res.json({ plan: record });
  } catch (err) {
    next(err);
  }
});

// 删除方案
app.delete('/api/plans/:id', async (req, res, next) => {
  try {
    const ok = await deletePlan(req.params.id);
    if (!ok) return res.status(404).json({ error: '方案不存在' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// 套准计算（不落盘，供编辑时实时校核）
app.post('/api/analyze', (req, res) => {
  const { valid, errors, data } = validatePlan(req.body);
  if (!valid) return res.status(400).json({ error: '输入校验未通过', errors });

  const rollers = data.rollers.map((r) => ({
    perimeter: r.perimeter,
    offset: r.offset
  }));
  const result = analyzePlan(rollers, data.clothLength);

  // BigInt 统一以十进制字符串输出，前端原样显示，不经过 Number
  res.json({ result: serializeResult(result) });
});

function serializeResult(result) {
  const bi = (v) => (typeof v === 'bigint' ? v.toString() : v);
  if (!result.solvable) {
    return {
      solvable: false,
      rollerCount: result.rollerCount,
      incompatiblePair: {
        a: result.incompatiblePair.a,
        b: result.incompatiblePair.b,
        perimeterA: bi(result.incompatiblePair.perimeterA),
        offsetA: bi(result.incompatiblePair.offsetA),
        perimeterB: bi(result.incompatiblePair.perimeterB),
        offsetB: bi(result.incompatiblePair.offsetB),
        gcd: bi(result.incompatiblePair.gcd)
      },
      positions: []
    };
  }
  return {
    solvable: true,
    rollerCount: result.rollerCount,
    firstPosition: bi(result.firstPosition),
    period: bi(result.period),
    totalInCloth: bi(result.totalInCloth),
    truncated: result.truncated,
    positions: result.positions.map(bi)
  };
}

// JSON 解析错误处理（返回 JSON 而非 Express 默认的 HTML）
app.use((err, _req, res, _next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: '请求体不是合法的 JSON' });
  }
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, HOST, () => {
  console.log(`多色滚筒套准校核服务已启动: http://${HOST}:${PORT}`);
});
