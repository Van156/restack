/**
 * A short, human-readable device label from a `User-Agent` header (e.g. "Chrome on macOS"), for
 * session lists and audit details. Deliberately small: it names the common browsers and operating
 * systems and falls back to "Unknown device" rather than guessing. Not a security signal.
 */

// Order matters: Edge and Opera also say "Chrome", Chrome also says "Safari".
const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/\b(?:Edg|EdgA|EdgiOS)\//, "Edge"],
  [/\bOPR\/|\bOpera\b/, "Opera"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bChrome\/|\bCriOS\//, "Chrome"],
  [/\bSafari\//, "Safari"],
];

// Order matters: iPhone/iPad UAs contain "like Mac OS X", Android UAs contain "Linux".
const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/\biPhone\b|\biPad\b|\biPod\b/, "iOS"],
  [/\bAndroid\b/, "Android"],
  [/\bWindows\b/, "Windows"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bMac OS X\b|\bMacintosh\b/, "macOS"],
  [/\bLinux\b/, "Linux"],
];

const UNKNOWN_DEVICE = "Unknown device";

function firstMatch(userAgent: string, table: readonly (readonly [RegExp, string])[]) {
  return table.find(([pattern]) => pattern.test(userAgent))?.[1];
}

export function describeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent) {
    return UNKNOWN_DEVICE;
  }
  const browser = firstMatch(userAgent, BROWSERS);
  const system = firstMatch(userAgent, SYSTEMS);
  if (browser && system) {
    return `${browser} on ${system}`;
  }
  return browser ?? system ?? UNKNOWN_DEVICE;
}
