/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // ─── Semantic Font Roles (8 local fonts) ─────────────────────────
        wordmark: ["var(--font-wordmark)", "sans-serif"],      // Bungee Shade - TMNL branding
        conversational: ["var(--font-conversational)", "sans-serif"], // Barlow Condensed - AI chat
        numeric: ["var(--font-numeric)", "sans-serif"],        // Orbitron - Stats, counters
        data: ["var(--font-data)", "monospace"],               // Share Tech Mono - Grids, tables
        terminal: ["var(--font-terminal)", "monospace"],       // VT323 - Retro, splash
        geometric: ["var(--font-geometric)", "sans-serif"],    // Geo - Minimalist numeric
        pixel: ["var(--font-pixel)", "monospace"],             // Silkscreen - Retro UI, badges
        hairline: ["var(--font-hairline)", "sans-serif"],      // Bungee Hairline - Thin accents

        // ─── Legacy Compatibility ────────────────────────────────────────
        tmnl: ["var(--font-tmnl)", "monospace"],               // → Orbitron
        display: ["var(--font-display)", "monospace"],         // → Orbitron
        body: ["var(--font-body)", "sans-serif"],              // → Barlow Condensed
        code: ["var(--font-code)", "monospace"],               // → Share Tech Mono

        // ─── Specialty ───────────────────────────────────────────────────
        lcd: ['"DSEG7"', '"Courier New"', "monospace"],        // Seven-segment LCD
        mono: ['"Share Tech Mono"', '"JetBrains Mono"', '"SF Mono"', '"Fira Code"', "monospace"],
      },
      fontWeight: {
        hairline: "100",
        thin: "200",
        light: "300",
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },
      fontSize: {
        "tmnl-4xs": ["6px", { lineHeight: "1.4", letterSpacing: "0.2em" }],
        "tmnl-3xs": ["7px", { lineHeight: "1.4", letterSpacing: "0.15em" }],
        "tmnl-2xs": ["8px", { lineHeight: "1.4", letterSpacing: "0.12em" }],
        "tmnl-xs": ["9px", { lineHeight: "1.5", letterSpacing: "0.1em" }],
        "tmnl-sm": ["10px", { lineHeight: "1.5", letterSpacing: "0.08em" }],
        "tmnl-base": ["11px", { lineHeight: "1.6", letterSpacing: "0.05em" }],
        "tmnl-md": ["12px", { lineHeight: "1.5", letterSpacing: "0.02em" }],
        "tmnl-lg": ["14px", { lineHeight: "1.4", letterSpacing: "0" }],
        "tmnl-xl": ["16px", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        "tmnl-2xl": ["18px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "tmnl-3xl": ["24px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "tmnl-4xl": ["32px", { lineHeight: "1", letterSpacing: "-0.03em" }],
        "tmnl-5xl": ["48px", { lineHeight: "1", letterSpacing: "-0.04em" }],
      },
      letterSpacing: {
        "tmnl-tight": "-0.04em",
        "tmnl-snug": "-0.02em",
        "tmnl-normal": "0",
        "tmnl-wide": "0.05em",
        "tmnl-wider": "0.1em",
        "tmnl-widest": "0.15em",
        "tmnl-ultra": "0.2em",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "0px",
        md: "0px",
        sm: "0px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}