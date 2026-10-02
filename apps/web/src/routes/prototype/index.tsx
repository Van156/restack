import { Badge } from "@base-template/ui/components/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@base-template/ui/components/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@base-template/ui/components/item";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { prototypes } from "./-registry";

/** Lab catalog: lists every registered prototype with its question and variants. */
export const Route = createFileRoute("/prototype/")({
  component: PrototypeIndex,
});

function PrototypeIndex() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Prototypes</h1>
        <p className="text-sm text-muted-foreground">
          Throwaway UI variants with mock data. Dev only: never reachable in production.
        </p>
      </div>
      {prototypes.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No prototypes yet</EmptyTitle>
            <EmptyDescription>Register one in routes/prototype/-registry.ts.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup>
          {prototypes.map((prototype) => (
            <Item key={prototype.to} variant="outline" render={<Link to={prototype.to} />}>
              <ItemContent>
                <ItemTitle>{prototype.title}</ItemTitle>
                <ItemDescription>{prototype.question}</ItemDescription>
              </ItemContent>
              <ItemActions>
                {prototype.variants.map((variant) => (
                  <Badge key={variant.key} variant="secondary">
                    {variant.key} {variant.name}
                  </Badge>
                ))}
                <ChevronRight className="size-4 text-muted-foreground" />
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    </main>
  );
}
