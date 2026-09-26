// 方案输入校验：所有数值以十进制字符串形式接收并校验，
// 再转换为 BigInt，因此不受 JS 安全整数范围限制。
//
// 规则：
//   - 色筒数量 2~8
//   - 周长：正整数（≥ 1）
//   - 偏移：非负整数，且严格小于该筒周长
//   - 布长：非负整数（≥ 0）
//   - 数字仅允许 0~9（不接受正负号、小数点、科学计数法、前导/尾随空格以外的空白）

const MAX_ROLLERS = 8;
const MIN_ROLLERS = 2;

/**
 * 解析十进制非负整数。
 * @returns {{ok: true, value: bigint} | {ok: false, reason: string}}
 */
export function parseNonNegativeInt(raw, fieldLabel) {
  if (typeof raw !== 'string') {
    return { ok: false, reason: `${fieldLabel}必须是字符串形式的整数` };
  }
  const s = raw.trim();
  if (s.length === 0) {
    return { ok: false, reason: `${fieldLabel}不能为空` };
  }
  if (!/^[0-9]+$/.test(s)) {
    return { ok: false, reason: `${fieldLabel}必须是非负整数（仅允许数字 0-9）` };
  }
  try {
    return { ok: true, value: BigInt(s) };
  } catch {
    return { ok: false, reason: `${fieldLabel}不是合法的整数` };
  }
}

/**
 * 校验完整方案（不做 BigInt 转换，供保存接口使用）。
 * @returns {{valid: boolean, errors: string[], data?: object}}
 */
export function validatePlan(input) {
  const errors = [];

  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, errors: ['请求体必须是 JSON 对象'] };
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length === 0) {
    errors.push('方案名称不能为空');
  } else if (name.length > 50) {
    errors.push('方案名称不能超过 50 个字符');
  }

  const clothLengthRaw = input.clothLength;
  let clothLength = null;
  {
    const parsed = parseNonNegativeInt(clothLengthRaw, '布长');
    if (!parsed.ok) {
      errors.push(parsed.reason);
    } else {
      clothLength = parsed.value;
    }
  }

  const rollersRaw = input.rollers;
  if (!Array.isArray(rollersRaw)) {
    errors.push('色筒列表必须是数组');
    return { valid: false, errors, data: { name, clothLengthRaw, rollersRaw } };
  }
  if (rollersRaw.length < MIN_ROLLERS || rollersRaw.length > MAX_ROLLERS) {
    errors.push(`色筒数量必须在 ${MIN_ROLLERS}～${MAX_ROLLERS} 个之间（当前 ${rollersRaw.length} 个）`);
  }

  const rollers = [];
  rollersRaw.forEach((item, i) => {
    const label = `色筒 ${i + 1}`;
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${label}的数据格式不正确`);
      return;
    }
    let perimeter = null;
    let offset = null;
    {
      const p = parseNonNegativeInt(item.perimeter, `${label} 重复周长`);
      if (!p.ok) {
        errors.push(p.reason);
      } else if (p.value === 0n) {
        errors.push(`${label} 重复周长必须是正整数（≥ 1）`);
      } else {
        perimeter = p.value;
      }
    }
    {
      const o = parseNonNegativeInt(item.offset, `${label} 标记偏移`);
      if (!o.ok) {
        errors.push(o.reason);
      } else {
        offset = o.value;
      }
    }
    if (perimeter !== null && offset !== null && offset >= perimeter) {
      errors.push(`${label} 标记偏移（${item.offset.trim()} mm）必须小于周长（${item.perimeter.trim()} mm）`);
    }
    rollers.push({
      perimeterRaw: typeof item.perimeter === 'string' ? item.perimeter.trim() : String(item.perimeter ?? ''),
      offsetRaw: typeof item.offset === 'string' ? item.offset.trim() : String(item.offset ?? ''),
      perimeter,
      offset
    });
  });

  const data = {
    name,
    clothLengthRaw: typeof clothLengthRaw === 'string' ? clothLengthRaw.trim() : String(clothLengthRaw ?? ''),
    clothLength,
    rollers
  };
  return { valid: errors.length === 0, errors, data };
}
