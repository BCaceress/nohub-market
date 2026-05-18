// SINGLE SOURCE OF TRUTH dos design tokens (decisão 17).
// Nunca usar hex hardcoded nos componentes — sempre tokens semânticos Tailwind.
// Rode `pnpm tokens` para gerar as CSS vars no globals.css.

export interface ColorScale {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
}

export interface SidebarTokens {
  background: string;
  foreground: string;
  border: string;
  accent: string;
  accentForeground: string;
}

export interface DesignTokens {
  colors: { light: ColorScale; dark: ColorScale };
  sidebar: { light: SidebarTokens; dark: SidebarTokens };
  radius: Record<string, string>;
  spacing: Record<string, string>;
  typography: {
    fontSans: string;
    fontMono: string;
    fontSizes: Record<string, string>;
  };
}

// Marca NoHub Market: primária #1A1A2E, acento #0F3460.
export const tokens: DesignTokens = {
  colors: {
    light: {
      background: "#FFFFFF",
      foreground: "#1A1A2E",
      card: "#FFFFFF",
      cardForeground: "#1A1A2E",
      popover: "#FFFFFF",
      popoverForeground: "#1A1A2E",
      primary: "#1A1A2E",
      primaryForeground: "#FAFAFA",
      secondary: "#F4F4F5",
      secondaryForeground: "#1A1A2E",
      muted: "#F4F4F5",
      mutedForeground: "#71717A",
      accent: "#0F3460",
      accentForeground: "#FAFAFA",
      destructive: "#DC2626",
      destructiveForeground: "#FAFAFA",
      border: "#E4E4E7",
      input: "#E4E4E7",
      ring: "#0F3460",
    },
    dark: {
      background: "#0F0F1A",
      foreground: "#FAFAFA",
      card: "#15151F",
      cardForeground: "#FAFAFA",
      popover: "#15151F",
      popoverForeground: "#FAFAFA",
      primary: "#FAFAFA",
      primaryForeground: "#1A1A2E",
      secondary: "#27272A",
      secondaryForeground: "#FAFAFA",
      muted: "#27272A",
      mutedForeground: "#A1A1AA",
      accent: "#0F3460",
      accentForeground: "#FAFAFA",
      destructive: "#EF4444",
      destructiveForeground: "#FAFAFA",
      border: "#27272A",
      input: "#27272A",
      ring: "#3B82F6",
    },
  },
  sidebar: {
    light: {
      background: "#FAFAFA",
      foreground: "#1A1A2E",
      border: "#E4E4E7",
      accent: "#F4F4F5",
      accentForeground: "#1A1A2E",
    },
    dark: {
      background: "#0F0F1A",
      foreground: "#FAFAFA",
      border: "#27272A",
      accent: "#15151F",
      accentForeground: "#FAFAFA",
    },
  },
  radius: {
    sm: "0.25rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
  },
  typography: {
    fontSans: "var(--font-geist-sans), system-ui, sans-serif",
    fontMono: "var(--font-geist-mono), ui-monospace, monospace",
    fontSizes: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
    },
  },
};

export default tokens;
