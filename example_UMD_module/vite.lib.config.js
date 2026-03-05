import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    emptyOutDir: false, // do not clear output dir - used by other builds
    // define: {
    //   'process.env.NODE_ENV': '"production"',
    //   'process.env': '{}',
    //   process: '{}',
    // },
    lib: {
      entry: 'src/entry.js',
      name: 'ZbxVueWidget', // Global name for UMD/IIFE wrapper
      formats: ['umd'], // or ['iife']
      fileName: () => 'example.umd.js', // Output file name
      cssFileName: 'example', // Output CSS file name (example.css)
    },
    rollupOptions: {
      // Do not externalize anything -> Vue, axios, echarts bundled inside
      external: [],
      output: {
        // Ensure it behaves as a library
        inlineDynamicImports: true,
      },
    },
  },
});
