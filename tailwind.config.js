/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  safelist: [{ pattern: /^(bg|text|border|ring|ring-offset)-.+$/ }],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px"
      }
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        // Reference type ramp: headlines/bodies/metrics set in Plus Jakarta
        // Sans, labels in Inter (exact family names requested by the design).
        "headline-xl": ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        "headline-xl-mobile": ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        "headline-lg": ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        "headline-md": ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        "title-md": ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        "body-md": ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        "body-lg": ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        "metric-display": ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        "metric-display-mobile": ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        "label-sm": ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        "label-md": ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        "label-lg": ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"]
      },
      fontSize: {
        "headline-xl": ["32px", { lineHeight: "40px", letterSpacing: "-0.03em", fontWeight: "800" }],
        "headline-xl-mobile": ["26px", { lineHeight: "34px", letterSpacing: "-0.02em", fontWeight: "800" }],
        "headline-lg": ["24px", { lineHeight: "32px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-md": ["20px", { lineHeight: "28px", letterSpacing: "-0.015em", fontWeight: "700" }],
        "title-md": ["16px", { lineHeight: "24px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "body-md": ["14px", { lineHeight: "20px", letterSpacing: "0em", fontWeight: "400" }],
        "body-lg": ["15px", { lineHeight: "22px", letterSpacing: "0em", fontWeight: "400" }],
        "metric-display": ["30px", { lineHeight: "36px", letterSpacing: "-0.025em", fontWeight: "800" }],
        "metric-display-mobile": ["22px", { lineHeight: "28px", letterSpacing: "-0.02em", fontWeight: "750" }],
        "label-sm": ["10px", { lineHeight: "14px", letterSpacing: "0.05em", fontWeight: "700" }],
        "label-md": ["11px", { lineHeight: "16px", letterSpacing: "0.04em", fontWeight: "700" }],
        "label-lg": ["13px", { lineHeight: "18px", letterSpacing: "0.01em", fontWeight: "600" }]
      },
      spacing: {
        "space-xs": "0.25rem",
        "space-sm": "0.5rem",
        "space-md": "1rem",
        "space-lg": "1.5rem",
        "space-xl": "2rem",
        gutter: "1.25rem",
        "gutter-mobile": "0.75rem",
        margin: "1.75rem",
        "margin-mobile": "1rem"
      },
      colors: {
        // Material 3 role tokens. Channels are defined in `index.css` for light
        // and dark, so every surface/outline/role adapts with the theme.
        surface: "rgb(var(--m3-surface) / <alpha-value>)",
        "surface-dim": "rgb(var(--m3-surface-dim) / <alpha-value>)",
        "surface-bright": "rgb(var(--m3-surface-bright) / <alpha-value>)",
        "surface-container-lowest": "rgb(var(--m3-surface-container-lowest) / <alpha-value>)",
        "surface-container-low": "rgb(var(--m3-surface-container-low) / <alpha-value>)",
        "surface-container": "rgb(var(--m3-surface-container) / <alpha-value>)",
        "surface-container-high": "rgb(var(--m3-surface-container-high) / <alpha-value>)",
        "surface-container-highest": "rgb(var(--m3-surface-container-highest) / <alpha-value>)",
        "on-surface": "rgb(var(--m3-on-surface) / <alpha-value>)",
        "on-surface-variant": "rgb(var(--m3-on-surface-variant) / <alpha-value>)",
        "inverse-surface": "#283044",
        "inverse-on-surface": "#eef0ff",
        outline: "rgb(var(--m3-outline) / <alpha-value>)",
        "outline-variant": "rgb(var(--m3-outline-variant) / <alpha-value>)",
        error: "rgb(var(--m3-error) / <alpha-value>)",
        // Extra M3 roles from the admin-reference design.
        "surface-variant": "rgb(var(--m3-surface-variant) / <alpha-value>)",
        "inverse-primary": "rgb(var(--m3-inverse-primary) / <alpha-value>)",
        "surface-tint": "rgb(var(--m3-surface-tint) / <alpha-value>)",
        "primary-fixed-dim": "rgb(var(--m3-primary-fixed-dim) / <alpha-value>)",
        "on-primary-fixed": "rgb(var(--m3-on-primary-fixed) / <alpha-value>)",
        "on-primary-fixed-variant": "rgb(var(--m3-on-primary-fixed-variant) / <alpha-value>)",
        "secondary-fixed-dim": "rgb(var(--m3-secondary-fixed-dim) / <alpha-value>)",
        // `primary`/`secondary`/`destructive` stay bound to the shadcn HSL
        // variables above; these add the M3 named containers/roles.
        "primary-container": "rgb(var(--m3-primary-container) / <alpha-value>)",
        "primary-fixed": "rgb(var(--m3-primary-fixed) / <alpha-value>)",
        "on-primary": "rgb(var(--m3-on-primary) / <alpha-value>)",
        "on-primary-container": "rgb(var(--m3-on-primary-container) / <alpha-value>)",
        "secondary-container": "rgb(var(--m3-secondary-container) / <alpha-value>)",
        "secondary-fixed": "rgb(var(--m3-secondary-fixed) / <alpha-value>)",
        "on-secondary": "rgb(var(--m3-on-secondary) / <alpha-value>)",
        "on-secondary-container": "rgb(var(--m3-on-secondary-container) / <alpha-value>)",
        tertiary: "rgb(var(--m3-tertiary) / <alpha-value>)",
        "tertiary-container": "rgb(var(--m3-tertiary-container) / <alpha-value>)",
        "tertiary-fixed": "rgb(var(--m3-tertiary-fixed) / <alpha-value>)",
        "on-tertiary": "rgb(var(--m3-on-tertiary) / <alpha-value>)",
        "on-tertiary-container": "rgb(var(--m3-on-tertiary-container) / <alpha-value>)",
        "error-container": "rgb(var(--m3-error-container) / <alpha-value>)",
        "on-error": "rgb(var(--m3-on-error) / <alpha-value>)",
        "on-error-container": "rgb(var(--m3-on-error-container) / <alpha-value>)",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: 0
          },
          to: {
            height: "var(--radix-accordion-content-height)"
          }
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)"
          },
          to: {
            height: 0
          }
        },
        // A deliberate on/off blink for the "live" indicators. It is stronger
        // than `animate-pulse` so a green live dot reads as active at a glance.
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.15" }
        },
        // A barely-there breathing pulse for primary action buttons. Kept weak
        // and slow so it reads as "alive" without pulling attention.
        blinkSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" }
        },
        // A short side-to-side rejection wobble. Played when an action is
        // refused (e.g. resolving a stock alert that is still low) so the
        // refusal reads as a physical "no" rather than a silent no-op.
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "15%": { transform: "translateX(-6px)" },
          "30%": { transform: "translateX(6px)" },
          "45%": { transform: "translateX(-4px)" },
          "60%": { transform: "translateX(4px)" },
          "80%": { transform: "translateX(-2px)" }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        blink: "blink 0.9s ease-in-out infinite",
        "blink-subtle": "blinkSubtle 3.5s ease-in-out infinite",
        shake: "shake 0.5s cubic-bezier(.36,.07,.19,.97) both"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};
