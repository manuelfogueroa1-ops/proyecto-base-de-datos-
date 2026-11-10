import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const backend = loadEnv(mode, '../backend', '');
  return {
    plugins: [react(), vue()],
    build: {
      rollupOptions: {
        input: {
          admin: fileURLToPath(new URL('./index.html', import.meta.url)),
          login: fileURLToPath(new URL('./login.html', import.meta.url)),
          portal: fileURLToPath(new URL('./portal.html', import.meta.url)),
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/api': { target: `http://127.0.0.1:${backend.PORT || 3000}`, changeOrigin: true } },
    },
  };
});
