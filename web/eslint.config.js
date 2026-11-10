import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  // Existing render/effect patterns: keep the rules active for all other files.
  {
    files: [
      'src/components/catalog/LocationPanel.tsx',
      'src/components/catalog/TimeControl.tsx',
      'src/components/controls/CameraControls.tsx',
      'src/components/debug/DebugPanel.tsx',
      'src/components/live-view/SkyDome/useThemeColors.ts',
    ],
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
  {
    files: ['src/components/live-view/NavOverlay.tsx'],
    rules: { 'react-hooks/purity': 'off' },
  },
  {
    files: [
      'src/components/catalog/CatalogFilters.tsx',
      'src/components/ui/badge.tsx',
      'src/components/ui/button.tsx',
      'src/components/ui/tabs.tsx',
    ],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['src/components/wizard/CalibrateStep.tsx'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
])
