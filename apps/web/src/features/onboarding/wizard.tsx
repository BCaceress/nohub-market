"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { trackOnboardingEvent } from "./metrics";
import { StepReview } from "./steps/step-review";
import { StepSegment } from "./steps/step-segment";
import { StepStockStructure } from "./steps/step-stock-structure";
import { StepStoreCount } from "./steps/step-store-count";
import { StepStoreNames } from "./steps/step-store-names";
import { useOnboarding } from "./store";

const STEPS: ReadonlyArray<readonly [string, string]> = [
  ["Segmento", "Como você opera?"],
  ["Lojas", "Quantas unidades você tem?"],
  ["Identificação", "Como elas se chamam?"],
  ["Estoque", "Estrutura do seu estoque"],
  ["Confirmar", "Tudo certo? Vamos criar sua conta"],
];

export function OnboardingWizard({ initialStep }: { initialStep: number }) {
  const { step, set } = useOnboarding();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (initialStep > step) set({ step: initialStep });
    setHydrated(true);
    if (initialStep <= 1) void trackOnboardingEvent("started");
  }, [initialStep, step, set]);

  if (!hydrated) return null;

  const next = () => set({ step: Math.min(5, step + 1) });
  const back = () => set({ step: Math.max(1, step - 1) });
  const current = STEPS[step - 1] ?? STEPS[0];
  if (!current) return null;
  const [title, desc] = current;

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>Passo {step} de 5</span>
          {step > 1 && step < 5 && (
            <button type="button" onClick={back} className="underline">
              Voltar
            </button>
          )}
        </div>
        <Progress value={(step / 5) * 100} />
        <CardTitle className="mt-4">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        {step === 1 && <StepSegment onNext={next} />}
        {step === 2 && <StepStoreCount onNext={next} />}
        {step === 3 && <StepStoreNames onNext={next} />}
        {step === 4 && <StepStockStructure onNext={next} />}
        {step === 5 && <StepReview />}
      </CardContent>
    </Card>
  );
}
