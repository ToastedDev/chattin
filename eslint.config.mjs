import antfu from "@antfu/eslint-config";

export default antfu({
  type: "app",
  ignores: [
    "node_modules",
    "**/node_modules/**",
    "dist",
    "**/dist/**",
    "out",
    "**/out/**",
    ".gitignore",
    "**/.gitignore/**",
    "src/renderer/src/routeTree.gen.ts",
    "src/renderer/src/components/ui/**/*",
  ],
  typescript: true,
  react: true,
  formatters: true,
  stylistic: {
    indent: 2,
    semi: true,
    quotes: "double",
  },
}, {
  rules: {
    "no-console": "warn",
    "antfu/no-top-level-await": "off",
    "node/prefer-global/process": "off",
    // "node/no-process-env": "error",
    "perfectionist/sort-imports": ["error", {
      internalPattern: ["@/**"],
    }],
    "unicorn/filename-case": ["error", {
      case: "kebabCase",
      ignore: ["README.md"],
    }],
  },
});
