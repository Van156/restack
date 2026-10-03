import { qrPath } from "@base-template/ui/lib/qr-path";
import { cn } from "@base-template/ui/lib/utils";

type QrPanelProps = {
  /** What the code opens when scanned. */
  url: string;
  /** Short code guests can type when they cannot scan. */
  shortCode?: string;
  title?: string;
  className?: string;
};

/** QR code for a URL on a white quiet zone so it scans in dark mode, with an optional short code. */
function QrPanel({ url, shortCode, title = "Código QR de la mesa", className }: QrPanelProps) {
  const { size, path } = qrPath(url);
  const quietZone = 4;
  const side = size + quietZone * 2;

  return (
    <figure
      data-slot="qr-panel"
      className={cn("flex w-fit flex-col items-center gap-3", className)}
    >
      <svg
        role="img"
        aria-label={title}
        viewBox={`0 0 ${side} ${side}`}
        shapeRendering="crispEdges"
        className="size-56 rounded-lg bg-white"
      >
        <path d={path} transform={`translate(${quietZone} ${quietZone})`} fill="#000" />
      </svg>
      {shortCode ? (
        <figcaption className="flex flex-col items-center text-sm">
          <span className="text-muted-foreground">Código corto</span>
          <span className="font-mono text-xl font-medium tracking-widest">{shortCode}</span>
        </figcaption>
      ) : null}
    </figure>
  );
}

export { QrPanel };
export type { QrPanelProps };
