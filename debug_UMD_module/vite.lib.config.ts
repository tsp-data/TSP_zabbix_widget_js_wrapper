import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // Vue (and other bundled libs) check process.env.NODE_ENV at runtime. Replacing it
  // at build time makes the UMD artifact self-contained and drops development-only
  // code paths - the wrapper does not provide any process shim, so a build without
  // this fails in Zabbix with "ReferenceError: process is not defined".
  //
  // Must sit at the top level of the config: `define` nested under `build` is
  // silently ignored by Vite.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    emptyOutDir: false, // do not clear output dir - used by other builds
    lib: {
      entry: 'src/entry.ts',
      name: 'ZbxVueWidget', // Global name for UMD/IIFE wrapper
      formats: ['umd'], // or ['iife']
      fileName: () => 'debug.umd.js', // Output file name
      cssFileName: 'debug', // Output CSS file name (debug.css)
    },
    rollupOptions: {
      // Do not externalize anything -> Vue bundled inside
      external: [],
      output: {
        // Ensure it behaves as a library
        inlineDynamicImports: true,
      },
    },
  },
})
