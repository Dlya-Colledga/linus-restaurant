import stylistic from "@stylistic/eslint-plugin";

export default [
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      "@stylistic/padding-line-between-statements": [
        "error",

        { blankLine: "always", prev: "import", next: "*" },
        { blankLine: "any", prev: "import", next: "import" },

        {
          blankLine: "always",
          prev: ["const", "let", "var"],
          next: "*",
        },

        {
          blankLine: "any",
          prev: ["const", "let", "var"],
          next: ["const", "let", "var"],
        },

        { blankLine: "always", prev: "const", next: "let" },

        { blankLine: "always", prev: "*", next: "function" },
        { blankLine: "always", prev: "function", next: "*" },

        { blankLine: "always", prev: "*", next: "return" },

        { blankLine: "always", prev: "block-like", next: "*" },
      ],
    },
  },
];
