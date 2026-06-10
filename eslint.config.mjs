import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      "**/.*/**",
      ".next/**",
      ".local-run/**",
      ".backup_overhaul_version/**",
      ".codex/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/app/test.tsx",
      "src_neural_dark_backup_20260510090635/**",
      "v1_restore/**",
      "public_neural_dark_backup/**",
      "graphify-out/**",
      "scratch/**",
      "scripts/**",
      "seed_*.ts",
    ],
  },
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react/no-unescaped-entities": "off",
      "prefer-const": "off",
    },
  },
];

export default eslintConfig;
