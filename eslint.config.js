import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

// Flat config (ESLint v9+). Replaces the legacy .eslintrc the old `lint`
// script expected. Covers browser app code plus the Node-context config files.
export default [
	// Build output and generated native projects. src-tauri/target holds Tauri's
	// codegen assets (brotli-compressed blobs with a .js extension); android/ and
	// ios/ are Capacitor's generated native projects and contain a copied,
	// minified web bundle under their assets. ESLint would try to parse all of
	// these and report "Unexpected character", so they are ignored — flat config
	// does not read nested .gitignore files.
	{
		ignores: [
			"dist",
			"dist-native",
			"dist-capacitor",
			"dev-dist",
			"node_modules",
			"src-tauri/target",
			"src-tauri/gen",
			"android",
			"ios",
		],
	},

	js.configs.recommended,

	// Application source — runs in the browser.
	{
		files: ["src/**/*.{js,jsx}"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: globals.browser,
			parserOptions: {
				ecmaFeatures: { jsx: true },
			},
		},
		plugins: {
			"react-hooks": reactHooks,
			"react-refresh": reactRefresh,
		},
		rules: {
			"react-hooks/rules-of-hooks": "error",
			"react-hooks/exhaustive-deps": "warn",
			"react-refresh/only-export-components": [
				"warn",
				{ allowConstantExport: true },
			],
			// Allow intentionally-unused capitalized/underscored identifiers
			// (e.g. unused destructured constants) without noise.
			"no-unused-vars": ["warn", { varsIgnorePattern: "^[A-Z_]" }],
		},
	},

	// Tooling/config files — run in Node.
	{
		files: ["*.{js,cjs,mjs}", "vite.config.js"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: globals.node,
		},
	},
];
