import { Globe } from "lucide-react";
import { siIfood, siShopee, siWhatsapp } from "simple-icons";
import type { ChannelDef, ChannelSiKey } from "./channel-catalog";

const SI: Record<ChannelSiKey, { path: string }> = {
  siIfood,
  siWhatsapp,
  siShopee,
};

/**
 * Tile do logo do canal: logo de marca (simple-icons) quando disponível,
 * senão ícone genérico (lucide) ou lettermark (iniciais na cor da marca).
 */
export function ChannelLogo({ ch, size = 40 }: { ch: ChannelDef; size?: number }) {
  const fg = ch.fg ?? "#fff";
  const glyph = size * 0.55;

  let inner: React.ReactNode;
  if (ch.siKey) {
    inner = (
      <svg
        role="img"
        aria-hidden="true"
        viewBox="0 0 24 24"
        width={glyph}
        height={glyph}
        fill="currentColor"
      >
        <path d={SI[ch.siKey].path} />
      </svg>
    );
  } else if (ch.lucide === "globe") {
    inner = <Globe style={{ width: glyph, height: glyph }} />;
  } else {
    inner = (
      <span className="font-bold leading-none" style={{ fontSize: size * 0.38 }}>
        {ch.initials}
      </span>
    );
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg"
      style={{ width: size, height: size, background: `#${ch.hex}`, color: fg }}
    >
      {inner}
    </span>
  );
}
