"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { trackOnboardingEvent } from "./metrics";
import { StepBusiness } from "./steps/step-business";
import { StepCatalog } from "./steps/step-catalog";
import { StepConfirm } from "./steps/step-confirm";
import { StepFinish } from "./steps/step-finish";
import { StepOperation } from "./steps/step-operation";
import { StepStructure } from "./steps/step-structure";
import { useOnboarding } from "./store";

const STEPS: ReadonlyArray<readonly [string, string]> = [
  ["Negócio", "Informe o CNPJ do seu negócio"],
  ["Confirmação", "Confirme os dados e o endereço"],
  ["Operação", "Como você opera e o que vende"],
  ["Estrutura", "Suas unidades físicas"],
  ["Catálogo", "Como montar seu catálogo"],
  ["Finalizar", "Fiscal e pagamentos"],
];

export function OnboardingWizard({ initialStep }: { initialStep: number }) {
  const { step, set } = useOnboarding();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Retoma do passo persistido no banco se estiver à frente (RN-11).
    if (initialStep > step) set({ step: initialStep });
    setHydrated(true);
    if (initialStep <= 1) void trackOnboardingEvent("started");
  }, [initialStep, step, set]);

  if (!hydrated) return null;

  const next = () => set({ step: Math.min(6, step + 1) });
  const back = () => set({ step: Math.max(1, step - 1) });
  const [title, desc] = STEPS[step - 1] ?? ["Negócio", ""];

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>Passo {step} de 6</span>
          {step > 1 && step < 6 && (
            <button type="button" onClick={back} className="underline">
              Voltar
            </button>
          )}
        </div>
        <Progress value={(step / 6) * 100} />
        <CardTitle className="mt-4">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        {step === 1 && <StepBusiness onNext={next} />}
        {step === 2 && <StepConfirm onNext={next} />}
        {step === 3 && <StepOperation onNext={next} />}
        {step === 4 && <StepStructure onNext={next} />}
        {step === 5 && <StepCatalog onNext={next} onSkip={next} />}
        {step === 6 && <StepFinish />}
      </CardContent>
    </Card>
  );
}
