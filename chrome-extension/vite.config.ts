import { resolve } from 'path'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Components from 'unplugin-vue-components/vite'
import crx from 'vite-plugin-crx-mv3'

const port = parseInt(process.env.PORT || '') || 3309
const r = (...args: string[]) => resolve(__dirname, ...args)

export default defineConfig(({ command }) => {
  const isDev = command === 'serve'

  return {
    root: r('src'),
    base: isDev ? `http://localhost:${port}/` : undefined,
    resolve: {
      alias: {
        '~/': `${r('src')}/`,
      },
    },
    server: {
      port,
      hmr: {
        host: 'localhost',
      },
    },
    build: {
      outDir: r('extension/prod'),
      emptyOutDir: false,
      sourcemap: isDev ? 'inline' : false,
      rollupOptions: {
        input: {
          popup: r('src/popup/index.html'),
          options: r('src/options/index.html'),
        },
      },
    },
    plugins: [
      Vue(),
      crx({
        manifest: './manifest.json'
      }),
      Components({
        dirs: [r('src/components')],
        // auto import icons
        resolvers: [
          IconsResolver({
            prefix: '',
          }),
        ],
      }),

      Icons(),

      // rewrite assets to use relative path
      {
        name: 'assets-rewrite',
        enforce: 'post',
        apply: 'build',
        transformIndexHtml(html) {
          return html.replace(/"\/assets\//g, '"../assets/')
        },
      },
    ],

    optimizeDeps: {
      include: [
        'vue',
        '@vueuse/core',
      ],
      exclude: [
        'vue-demi',
      ],
    },
  }
})
