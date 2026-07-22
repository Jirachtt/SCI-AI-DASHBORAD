const OVERRIDE_PATTERNS = [
  /\b(?:ignore|disregard|forget|override)\b[\s\S]{0,80}\b(?:previous|prior|system|developer|instruction|rules?)\b/i,
  /(?:เพิกเฉย|ละเว้น|ลืม|ข้าม|ไม่ต้องทำตาม)[\s\S]{0,80}(?:คำสั่ง|กฎ|ข้อกำหนด|นโยบาย)/i,
];

const SECRET_PATTERNS = [
  /\b(?:reveal|show|print|expose|return)\b[\s\S]{0,80}\b(?:system\s*prompt|developer\s*(?:message|instruction)|api\s*key|secret|token|cookie)\b/i,
  /(?:เปิดเผย|แสดง|พิมพ์|บอก)[\s\S]{0,80}(?:พรอมต์|คำสั่งภายใน|คำสั่งระบบ|คีย์|โทเคน|คุกกี้|ความลับ)/i,
];

const PRIVILEGE_PATTERNS = [
  /\b(?:change|set|upgrade|elevate|grant|bypass)\b[\s\S]{0,80}\b(?:my\s+role|role|permission|rbac|admin|dean|system)\b/i,
  /\b(?:act|behave|pretend)\s+as\s+(?:an?\s+)?(?:admin|dean|system)\b/i,
  /(?:เปลี่ยน|ตั้ง|ยกระดับ|ให้|ข้าม)[\s\S]{0,80}(?:บทบาท|role|สิทธิ์|แอดมิน|admin|คณบดี|dean)/i,
];

function matchesAny(text, patterns) {
  return patterns.some(pattern => pattern.test(text));
}

/**
 * Detect direct attempts to override the assistant and extract secrets or
 * elevate access. A single security-related phrase is not enough, so normal
 * educational questions about prompt injection remain usable.
 */
export function detectDirectPromptInjection(value) {
  const text = String(value || '').trim().slice(0, 24_000);
  if (!text) return { detected: false, signals: [] };

  const signals = [];
  if (matchesAny(text, OVERRIDE_PATTERNS)) signals.push('instruction_override');
  if (matchesAny(text, SECRET_PATTERNS)) signals.push('secret_exfiltration');
  if (matchesAny(text, PRIVILEGE_PATTERNS)) signals.push('privilege_escalation');

  return {
    detected: signals.length >= 2,
    signals,
  };
}

