import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  // Icons from game-icons.net, compiled into Solid components as they are imported
  plugins: [solidPlugin(), tailwindcss(), Icons({ compiler: 'solid' })],
});
