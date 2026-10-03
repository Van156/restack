import { encode } from "uqr";

/** SVG path of a QR code for `text`: one horizontal run of dark modules per `M x yhN v1 h-N z`. */
export function qrPath(text: string): { size: number; path: string } {
  const { data, size } = encode(text, { ecc: "M", border: 0 });
  const runs: string[] = [];
  data.forEach((row, y) => {
    let x = 0;
    while (x < size) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < size && row[x]) {
        x += 1;
      }
      const width = x - start;
      runs.push(`M${start} ${y}h${width}v1h-${width}z`);
    }
  });
  return { size, path: runs.join("") };
}
