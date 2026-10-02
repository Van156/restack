import { describe, expect, test } from "bun:test";

import { describeUserAgent } from "./user-agent";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const FIREFOX_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0";
const EDGE_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const CHROME_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

describe("describeUserAgent", () => {
  test("names browser and system for common user agents", () => {
    expect(describeUserAgent(CHROME_MAC)).toBe("Chrome on macOS");
    expect(describeUserAgent(SAFARI_IPHONE)).toBe("Safari on iOS");
    expect(describeUserAgent(FIREFOX_WINDOWS)).toBe("Firefox on Windows");
    expect(describeUserAgent(CHROME_LINUX)).toBe("Chrome on Linux");
  });

  test("prefers the specific browser over the engine tokens it also sends", () => {
    expect(describeUserAgent(EDGE_WINDOWS)).toBe("Edge on Windows");
  });

  test("prefers Android over Linux", () => {
    expect(describeUserAgent(CHROME_ANDROID)).toBe("Chrome on Android");
  });

  test("names only what it recognizes", () => {
    expect(describeUserAgent("curl/8.4.0")).toBe("Unknown device");
    expect(describeUserAgent("Mozilla/5.0 (Windows NT 10.0)")).toBe("Windows");
    expect(describeUserAgent("Firefox/127.0")).toBe("Firefox");
  });

  test("falls back for a missing user agent", () => {
    expect(describeUserAgent(null)).toBe("Unknown device");
    expect(describeUserAgent(undefined)).toBe("Unknown device");
    expect(describeUserAgent("")).toBe("Unknown device");
  });
});
