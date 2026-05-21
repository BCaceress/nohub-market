"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle, Camera, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Props {
  onScanned: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScanned, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();

        if (!videoRef.current || cancelled) return;

        setLoading(false);

        const controls = await reader.decodeFromVideoDevice(
          undefined, // use default camera
          videoRef.current,
          (result, err) => {
            if (cancelled) return;
            if (result) {
              const text = result.getText();
              // Basic EAN/UPC validation: 8–14 digits
              if (/^\d{8,14}$/.test(text)) {
                onScanned(text);
              }
            }
            // Ignore scanning errors (normal when no barcode in frame)
            void err;
          },
        );

        stopRef.current = () => controls.stop();
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("Permission") || msg.includes("NotAllowed")) {
            setError(
              "Permissão de câmera negada. Autorize o acesso nas configurações do navegador.",
            );
          } else if (msg.includes("NotFound") || msg.includes("DevicesNotFound")) {
            setError("Nenhuma câmera encontrada neste dispositivo.");
          } else {
            setError("Não foi possível iniciar a câmera. Tente inserir o código manualmente.");
          }
          setLoading(false);
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      stopRef.current?.();
    };
  }, [onScanned]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Ler código de barras</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Camera view */}
        <div className="relative bg-black aspect-[4/3] flex items-center justify-center">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}

          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-white/90">{error}</p>
            </div>
          ) : (
            <>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />
              {/* Aim overlay */}
              {!loading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-56 h-28 relative">
                    {/* Corners */}
                    {[
                      "top-0 left-0 border-t-2 border-l-2 rounded-tl-md",
                      "top-0 right-0 border-t-2 border-r-2 rounded-tr-md",
                      "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-md",
                      "bottom-0 right-0 border-b-2 border-r-2 rounded-br-md",
                    ].map((cls) => (
                      <div key={cls} className={`absolute w-6 h-6 border-white ${cls}`} />
                    ))}
                    {/* Scan line */}
                    <div className="absolute left-2 right-2 top-1/2 h-px bg-red-400/70 animate-pulse" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground">
            Aponte a câmera para o código de barras EAN do produto
          </p>
        </div>
      </div>
    </div>
  );
}
