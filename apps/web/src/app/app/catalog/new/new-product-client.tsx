"use client";

import { PencilLine, Sparkles } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductForm, type ProductFormInitialValues } from "@/features/app/product-form";
import { AiProductLookup } from "@/features/catalog/ai-product-lookup";
import type { OpenFoodFactsProduct } from "@/features/inventory/actions/ai-product-actions";

type Supplier = { id: string; name: string };
type Capability = { key: string };

interface Props {
  organizationId: string;
  suppliers: Supplier[];
  capabilities: Capability[];
}

export function NewProductClient({ organizationId, suppliers, capabilities }: Props) {
  const [tab, setTab] = useState<string>("ai");
  const [initialValues, setInitialValues] = useState<ProductFormInitialValues | undefined>();
  // key to force ProductForm re-mount when AI data fills in
  const [formKey, setFormKey] = useState(0);

  function handleAiFound(product: OpenFoodFactsProduct) {
    const iv: ProductFormInitialValues = {
      name: product.name,
      brand: product.brand,
      category: product.category,
      barcode: product.barcode,
      unit: product.weight !== undefined && product.weight < 1000 ? "G" : "UN",
    };
    setInitialValues(iv);
    setFormKey((k) => k + 1);
    setTab("manual");
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Novo produto</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Preencha manualmente ou use a busca por código de barras para preencher automaticamente.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-0">
        <TabsList variant="pills" className="w-fit mb-5">
          <TabsTrigger value="ai" variant="pills" icon={<Sparkles className="h-3.5 w-3.5" />}>
            Busca inteligente
          </TabsTrigger>
          <TabsTrigger value="manual" variant="pills" icon={<PencilLine className="h-3.5 w-3.5" />}>
            Cadastro manual
          </TabsTrigger>
        </TabsList>

        {/* AI tab */}
        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle>Busca por código de barras</CardTitle>
              <CardDescription>
                Digite ou escaneie o código EAN do produto. Os dados serão buscados automaticamente
                na base Open Food Facts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AiProductLookup onFound={handleAiFound} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual tab */}
        <TabsContent value="manual">
          <Card>
            <CardHeader>
              <CardTitle>Dados do produto</CardTitle>
              {initialValues?.name && (
                <CardDescription className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                  Campos pré-preenchidos pela busca inteligente. Revise antes de salvar.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <ProductForm
                key={formKey}
                organizationId={organizationId}
                suppliers={suppliers}
                capabilities={capabilities}
                initialValues={initialValues}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
