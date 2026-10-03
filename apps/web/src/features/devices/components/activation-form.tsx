import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";

import SubmitButton from "@/shared/components/form/submit-button";

/** The code entry of the public activation page, sized for a kitchen screen. */
export default function ActivationForm({
  code,
  error,
  isPending,
  onCodeChange,
  onSubmit,
}: {
  code: string;
  error: string | null;
  isPending: boolean;
  onCodeChange: (code: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="activation-code">Código de la pantalla</FieldLabel>
        <Input
          id="activation-code"
          size="lg"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="font-mono tracking-widest uppercase"
          value={code}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onCodeChange(event.target.value)}
        />
        <FieldDescription>
          Lo genera el propietario o un administrador en Dispositivos.
        </FieldDescription>
        {error ? <FieldError errors={[{ message: error }]} /> : null}
      </Field>
      <SubmitButton
        size="lg"
        isPending={isPending}
        pendingLabel="Activando..."
        disabled={code.trim() === ""}
      >
        Activar pantalla
      </SubmitButton>
    </form>
  );
}
