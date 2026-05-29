import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        borderRadius: 40,
        background: "#18181b",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        fontSize: 90,
        fontWeight: 700,
        fontFamily: "sans-serif",
        letterSpacing: "-2px",
      }}
    >
      N
    </div>,
    { ...size },
  );
}
