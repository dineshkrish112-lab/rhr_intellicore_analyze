import { fileURLToPath } from 'node:url'

// Resolve the Tailwind config from this folder so builds work from any working directory.
export default {
  plugins: {
    tailwindcss: { config: fileURLToPath(new URL('./tailwind.config.js', import.meta.url)) },
    autoprefixer: {},
  },
}
