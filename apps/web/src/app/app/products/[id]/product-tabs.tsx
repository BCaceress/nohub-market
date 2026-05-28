"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

interface Props {
  isVariant: boolean;
  isKit: boolean;
  variantCount: number;
  kitCount: number;
  packageCount: number;
  hasTaxData: boolean;
  dadosContent: React.ReactNode;
  variantesContent?: React.ReactNode;
  kitContent?: React.ReactNode;
  packagesContent: React.ReactNode;
  fiscalContent: React.ReactNode;
}

export function ProductTabs({
  isVariant,
  isKit,
  variantCount,
  kitCount,
  packageCount,
  hasTaxData,
  dadosContent,
  variantesContent,
  kitContent,
  packagesContent,
  fiscalContent,
}: Props) {
  const [tab, setTab] = useState("dados");

  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-0">
      <TabsList variant="underline">
        <TabsTrigger value="dados" variant="underline">
          Dados gerais
        </TabsTrigger>
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
        <TabsTrigger value="embalagens" variant="underline" badge={packageCount || undefined}>
          Embalagens
        </TabsTrigger>
        <TabsTrigger value="fiscal" variant="underline">
          Fiscal
          {!hasTaxData && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-amber-500" />}
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

      <TabsContent value="embalagens" className="pt-5">
        {packagesContent}
      </TabsContent>

      <TabsContent value="fiscal" className="pt-5">
        {fiscalContent}
      </TabsContent>
    </Tabs>
  );
}
