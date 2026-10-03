import { formatCop } from "@base-template/ui/lib/format-cop";
import { tenderLabel, type Tender } from "@base-template/ui/lib/bill-ledger";
import { formatSaleTime } from "@base-template/ui/lib/sale-time";
import { cn } from "@base-template/ui/lib/utils";

type ContingencyTicketProps = {
  restaurant: { name: string; nit?: string; address?: string };
  /** The Location that made the sale; its address replaces the Restaurant's when both are given. */
  location?: { name: string; address?: string };
  /** Who charged. */
  cashier?: string;
  /** Document number when the Restaurant assigned one. */
  number?: string | null;
  /** Original sale time, kept even when the ticket is reprinted later. */
  soldAt: Date;
  buyer?: { name: string; documentNumber: string } | null;
  lines: readonly {
    id: string;
    quantity: number;
    name: string;
    unitPrice: number;
    total: number;
  }[];
  taxes: readonly { label: string; amount: number }[];
  total: number;
  /** Voluntary tip, outside the tax base. */
  tip: number;
  payments: readonly { id: string; tender: Tender; amount: number }[];
  className?: string;
};

function Row({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-2", strong && "font-semibold")}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatCop(amount)}</dd>
    </div>
  );
}

/** Printable proof for a sale made offline: POS data without CUDE, QR or signature. */
function ContingencyTicket({
  restaurant,
  location,
  cashier,
  number,
  soldAt,
  buyer,
  lines,
  taxes,
  total,
  tip,
  payments,
  className,
}: ContingencyTicketProps) {
  return (
    <article
      data-slot="contingency-ticket"
      aria-label="Tiquete de contingencia"
      className={cn(
        "w-80 bg-white p-4 font-mono text-xs text-black print:w-full print:p-0",
        className,
      )}
    >
      <header className="flex flex-col items-center text-center">
        <h2 className="text-sm font-semibold">{restaurant.name}</h2>
        {restaurant.nit ? <p>NIT {restaurant.nit}</p> : null}
        {location ? <p>Local: {location.name}</p> : null}
        {(location?.address ?? restaurant.address) ? (
          <p>{location?.address ?? restaurant.address}</p>
        ) : null}
        <p className="mt-2 font-semibold uppercase">Tiquete de contingencia</p>
        {number ? <p>No. {number}</p> : null}
        <p>Fecha de la venta: {formatSaleTime(soldAt)}</p>
        <p className="font-semibold">registrado sin conexión</p>
      </header>
      {cashier ? <p className="mt-2">Cajero: {cashier}</p> : null}
      <p className={cashier ? undefined : "mt-2"}>
        Cliente: {buyer ? `${buyer.name} · ${buyer.documentNumber}` : "Consumidor final"}
      </p>
      <hr className="my-2 border-dashed border-black" />
      <ul className="flex flex-col gap-1">
        {lines.map((line) => (
          <li key={line.id}>
            <div>{line.name}</div>
            <div className="flex justify-between gap-2">
              <span>
                {line.quantity} × {formatCop(line.unitPrice)}
              </span>
              <span className="tabular-nums">{formatCop(line.total)}</span>
            </div>
          </li>
        ))}
      </ul>
      <hr className="my-2 border-dashed border-black" />
      <dl className="flex flex-col gap-0.5">
        {taxes.map((tax) => (
          <Row key={tax.label} label={tax.label} amount={tax.amount} />
        ))}
        <Row label="Total" amount={total} strong />
        <Row label="Propina voluntaria" amount={tip} />
        {payments.map((payment) => (
          <Row key={payment.id} label={tenderLabel(payment.tender)} amount={payment.amount} />
        ))}
      </dl>
      <p className="mt-3 text-center">
        Este tiquete respalda la venta hecha sin conexión. La factura electrónica se transmitirá a
        la DIAN al recuperar la conexión.
      </p>
    </article>
  );
}

export { ContingencyTicket };
export type { ContingencyTicketProps };
