import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";
import {
  balanceSummary,
  tenderLabel,
  totalChange,
  type Tender,
} from "@base-template/ui/lib/bill-ledger";
import { formatCop } from "@base-template/ui/lib/format-cop";
import { cn } from "@base-template/ui/lib/utils";

type BillLedgerLine = {
  id: string;
  quantity: number;
  name: string;
  /** Tax base of the line, integer COP. */
  base: number;
  tax: number;
  /** Line total with tax included, after discounts. */
  total: number;
};

type BillLedgerPayment = {
  id: string;
  tender: Tender;
  amount: number;
  /** Cash handed back to the customer; zero for other tenders. */
  change: number;
  reference?: string | null;
  registeredOffline?: boolean;
};

type BillLedgerProps = {
  lines: readonly BillLedgerLine[];
  /** Tax itemized by kind, e.g. impoconsumo and IVA. */
  taxes: readonly { label: string; amount: number }[];
  discountTotal: number;
  total: number;
  /** Voluntary tip, outside the tax base and not part of `total`. */
  tip: number;
  payments: readonly BillLedgerPayment[];
  /** Total plus tip minus payments; negative when the customer paid too much. */
  balanceDue: number;
  className?: string;
};

function AmountRow({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) {
  return (
    <TableRow className={cn(strong && "font-semibold")}>
      <TableCell colSpan={3}>{label}</TableCell>
      <TableCell className="text-right tabular-nums">{formatCop(amount)}</TableCell>
    </TableRow>
  );
}

/** Bill with itemized tax, discount, total, the tip as a separate line, payments and balance. */
function BillLedger({
  lines,
  taxes,
  discountTotal,
  total,
  tip,
  payments,
  balanceDue,
  className,
}: BillLedgerProps) {
  const balance = balanceSummary(balanceDue);
  const change = totalChange(payments);

  return (
    <Table data-slot="bill-ledger" className={className}>
      <TableHeader>
        <TableRow>
          <TableHead>Producto</TableHead>
          <TableHead className="text-right">Base</TableHead>
          <TableHead className="text-right">Impuesto</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line) => (
          <TableRow key={line.id}>
            <TableCell>
              {line.quantity} × {line.name}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatCop(line.base)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCop(line.tax)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCop(line.total)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        {taxes.map((tax) => (
          <AmountRow key={tax.label} label={tax.label} amount={tax.amount} />
        ))}
        {discountTotal > 0 ? <AmountRow label="Descuento" amount={-discountTotal} /> : null}
        <AmountRow label="Total consumo" amount={total} strong />
        <AmountRow label="Propina voluntaria (fuera de la base del impuesto)" amount={tip} />
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell colSpan={3}>
              {tenderLabel(payment.tender)}
              {payment.reference ? ` · Ref. ${payment.reference}` : ""}
              {payment.registeredOffline ? " · registrado sin conexión" : ""}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatCop(payment.amount)}</TableCell>
          </TableRow>
        ))}
        <AmountRow label={balance.label} amount={balance.amount} strong />
        {change > 0 ? <AmountRow label="Cambio" amount={change} /> : null}
      </TableFooter>
    </Table>
  );
}

export { BillLedger };
export type { BillLedgerLine, BillLedgerPayment, BillLedgerProps };
