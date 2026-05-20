"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Props {
  isVariant: boolean;
  isKit: boolean;
  variantCount: number;
  kitCount: number;
  hasTaxData: boolean;
  dadosContent: React.ReactNode;
  variantesContent?: React.ReactNode;
  kitContent?: React.ReactNode;
  fiscalContent: React.ReactNode;
}

export function ProductTabs({
  isVariant, isKit, variantCount, kitCount, hasTaxData,
  dadosContent, variantesContent, kitContent, fiscalContent,
}: Props) {
  const [tab, setTab] = useState("dados");

  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-0">
      <TabsList variant="underline">
        <TabsTrigger value="dados" variant="underline">Dados gerais</TabsTrigger>
        {isVariant && (
          <TabsTrigger value="variantes" variant="underline" badge={variantCount}>
            Variantes
          </TabsTrigger>
        )}
        {isKit && (
          <TabsTrigger value="kit" variant="underline" badge={kitCount}>
            Composição
          </TabsTrigger>
        )}
        <TabsTrigger value="fiscal" variant="underline">
          Fiscal
          {!hasTaxData && (
            <span className="ml-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="dados" className="pt-5">
        {dadosContent}
      </TabsContent>

      {isVariant && variantesContent && (
        <TabsContent value="variantes" className="pt-5">
          {variantesContent}
        </TabsContent>
      )}

      {isKit && kitContent && (
        <TabsContent value="kit" className="pt-5">
          {kitContent}
        </TabsContent>
      )}

      <TabsContent value="fiscal" className="pt-5">
        {fiscalContent}
      </TabsContent>
    </Tabs>
  );
}
