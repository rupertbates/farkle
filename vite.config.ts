import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves project sites from https://<user>.github.io/<repo>/, so assets
  // need to be resolved from that subpath rather than the domain root. Only applied
  // when building for Pages (see .github/workflows/deploy-pages.yml) so local dev and
  // any other deployment target still serve from "/".
  base: process.env.GITHUB_PAGES === 'true' ? '/farkle/' : '/',
})
