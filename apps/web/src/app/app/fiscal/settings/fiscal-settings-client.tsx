"use client";

import { useState, useTransition } from "react";
import type { FiscalSettingsData } from "@/features/fiscal/actions/fiscal-actions";
import {
  promoteToProductionAction,
  updateFiscalConfigAction,
  uploadCertificateAction,
} from "@/features/fiscal/actions/fiscal-actions";

type Props = {
  config: FiscalSettingsData["config"];
  certificate: FiscalSettingsData["certificate"];
  error: string | null;
};

export function FiscalSettingsClient({ config, certificate, error }: Props) {
  // Config form
  const [provider, setProvider] = useState(config?.provider ?? "FOCUS_NFE");
  const [series, setSeries] = useState(String(config?.nfceSeries ?? 1));
  const [cscId, setCscId] = useState(config?.nfceCscId ?? "");
  const [cscToken, setCscToken] = useState("");
  const [baasToken, setBaasToken] = useState("");

  // Certificate form
  const [pfxBase64, setPfxBase64] = useState("");
  const [password, setPassword] = useState("");
  const [subject, setSubject] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSaveConfig() {
    startTransition(async () => {
      const result = await updateFiscalConfigAction({
        provider: provider as "FOCUS_NFE" | "TECNOSPEED",
        nfceSeries: Number.parseInt(series, 10),
        nfceCscId: cscId || undefined,
        nfceCscToken: cscToken || undefined,
        baasToken: baasToken || undefined,
      });
      if (result.success) {
        setMessage({ type: "success", text: "Configuração salva com sucesso" });
        setCscToken("");
        setBaasToken("");
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
  }

  function handleUploadCert() {
    startTransition(async () => {
      const result = await uploadCertificateAction({
        pfxBase64,
        password,
        subject,
        validFrom: new Date(validFrom).toISOString(),
        validTo: new Date(validTo).toISOString(),
      });
      if (result.success) {
        setMessage({ type: "success", text: "Certificado A1 enviado com sucesso" });
        setPfxBase64("");
        setPassword("");
        window.location.reload();
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
  }

  function handlePromote() {
    if (
      !confirm(
        "Tem certeza que deseja promover para PRODUÇÃO? Esta ação emitirá notas fiscais reais.",
      )
    )
      return;
    startTransition(async () => {
      const result = await promoteToProductionAction();
      if (result.success) {
        setMessage({ type: "success", text: "Ambiente promovido para Produção!" });
        window.location.reload();
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
  }

  // Handle PFX file reading
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const arrayBuffer = ev.target?.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i] ?? 0);
      setPfxBase64(btoa(binary));
    };
    reader.readAsArrayBuffer(file);
  }

  const isProduction = config?.environment === "PRODUCTION";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Configurações Fiscais</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div
          className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}
        >
          {message.text}
        </div>
      )}

      {/* Ambiente */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Ambiente</h2>
          <span
            className={`px-2.5 py-0.5 rounded-full text-sm font-medium ${isProduction ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
          >
            {isProduction ? "Produção" : "Homologação"}
          </span>
        </div>
        {!isProduction && (
          <div>
            <p className="text-sm text-gray-500 mb-3">
              Você está em homologação. Emita pelo menos uma nota de teste antes de promover.
              {config?.homologationTestedAt && (
                <span className="text-green-600 ml-1">
                  ✓ Nota de teste emitida em{" "}
                  {new Date(config.homologationTestedAt).toLocaleDateString("pt-BR")}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={handlePromote}
              disabled={isPending || !config?.homologationTestedAt}
              className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
            >
              Promover para Produção
            </button>
          </div>
        )}
      </div>

      {/* Config geral */}
      <div className="rounded-lg border p-4 space-y-4">
        <h2 className="font-semibold">Configuração NFCe</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="cfg-provider" className="block text-sm font-medium text-gray-700 mb-1">
              Provider BaaS
            </label>
            <select
              id="cfg-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="FOCUS_NFE">Focus NFe</option>
              <option value="TECNOSPEED">TecnoSpeed</option>
            </select>
          </div>

          <div>
            <label htmlFor="cfg-series" className="block text-sm font-medium text-gray-700 mb-1">
              Série NFCe
            </label>
            <input
              id="cfg-series"
              type="number"
              value={series}
              onChange={(e) => setSeries(e.target.value)}
              min={1}
              max={999}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="cfg-csc-id" className="block text-sm font-medium text-gray-700 mb-1">
              ID do CSC
            </label>
            <input
              id="cfg-csc-id"
              type="text"
              value={cscId}
              onChange={(e) => setCscId(e.target.value)}
              placeholder="Ex: 000001"
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="cfg-csc-token" className="block text-sm font-medium text-gray-700 mb-1">
              Token CSC{" "}
              {config?.hasCscToken && <span className="text-green-600 text-xs">(configurado)</span>}
            </label>
            <input
              id="cfg-csc-token"
              type="password"
              value={cscToken}
              onChange={(e) => setCscToken(e.target.value)}
              placeholder={config?.hasCscToken ? "Deixe em branco para manter" : "Token do CSC"}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div className="col-span-2">
            <label
              htmlFor="cfg-baas-token"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Token BaaS{" "}
              {config?.hasBaasToken && (
                <span className="text-green-600 text-xs">(configurado)</span>
              )}
            </label>
            <input
              id="cfg-baas-token"
              type="password"
              value={baasToken}
              onChange={(e) => setBaasToken(e.target.value)}
              placeholder={
                config?.hasBaasToken ? "Deixe em branco para manter" : "Token da API do BaaS"
              }
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveConfig}
          disabled={isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Salvando…" : "Salvar configuração"}
        </button>
      </div>

      {/* Certificado A1 */}
      <div className="rounded-lg border p-4 space-y-4">
        <h2 className="font-semibold">Certificado A1</h2>

        {certificate && (
          <div
            className={`rounded-md p-3 text-sm ${certificate.isActive ? "bg-green-50 border border-green-200" : "bg-yellow-50 border border-yellow-200"}`}
          >
            <p
              className={`font-medium ${certificate.isActive ? "text-green-700" : "text-yellow-700"}`}
            >
              {certificate.isActive ? "✓ Certificado ativo" : "⚠ Certificado inativo"}
            </p>
            <p className="text-gray-600 mt-1">Titular: {certificate.subject}</p>
            <p className="text-gray-600">
              Válido de {new Date(certificate.validFrom).toLocaleDateString("pt-BR")} até{" "}
              <span
                className={
                  new Date(certificate.validTo) < new Date() ? "text-red-600 font-medium" : ""
                }
              >
                {new Date(certificate.validTo).toLocaleDateString("pt-BR")}
              </span>
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Enviado em {new Date(certificate.uploadedAt).toLocaleDateString("pt-BR")}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label htmlFor="cert-pfx" className="block text-sm font-medium text-gray-700 mb-1">
              Arquivo .pfx
            </label>
            <input
              id="cert-pfx"
              type="file"
              accept=".pfx,.p12"
              onChange={handleFileChange}
              className="w-full text-sm"
            />
            {pfxBase64 && <p className="text-xs text-green-600 mt-1">✓ Arquivo carregado</p>}
          </div>

          <div>
            <label htmlFor="cert-password" className="block text-sm font-medium text-gray-700 mb-1">
              Senha do certificado
            </label>
            <input
              id="cert-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha do .pfx"
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="cert-subject" className="block text-sm font-medium text-gray-700 mb-1">
              Titular (CNPJ do certificado)
            </label>
            <input
              id="cert-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: 12.345.678/0001-99"
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="cert-valid-from"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Válido de
              </label>
              <input
                id="cert-valid-from"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="cert-valid-to"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Válido até
              </label>
              <input
                id="cert-valid-to"
                type="date"
                value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleUploadCert}
          disabled={isPending || !pfxBase64 || !password || !subject || !validFrom || !validTo}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Enviando…" : "Enviar certificado"}
        </button>
        <p className="text-xs text-gray-400">
          ⚠ Senha não é armazenada em texto plano — cifrada com AES-256-GCM.
        </p>
      </div>
    </div>
  );
}
