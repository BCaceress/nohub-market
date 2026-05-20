import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "#18181b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontSize: 16,
          fontWeight: 700,
          fontFamily: "sans-serif",
          letterSpacing: "-0.5px",
        }}
      >
        N
      </div>
    ),
    { ...size },
  );
}
