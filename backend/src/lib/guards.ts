const daily = new Map<string, { day: string; count: number }>();

export function enforceReceiptCaps(args: {
  maxItems: number;
  maxChars: number;
  items: { key: string; text: string }[];
}) {
  const trimmed: { key: string; text: string }[] = [];
  let chars = 0;

  for (const it of args.items) {
    if (trimmed.length >= args.maxItems) break;
    const add = it.text.length;
    if (chars + add > args.maxChars) break;
    trimmed.push(it);
    chars += add;
  }

  return { trimmed, charsUsed: chars };
}

export function rateLimitDaily(deviceId: string, maxPerDay: number) {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const cur = daily.get(deviceId);

  if (!cur || cur.day !== day) {
    daily.set(deviceId, { day, count: 1 });
    return { ok: true, remaining: maxPerDay - 1 };
  }

  if (cur.count >= maxPerDay) {
    return { ok: false, remaining: 0 };
  }

  cur.count += 1;
  return { ok: true, remaining: maxPerDay - cur.count };
}
