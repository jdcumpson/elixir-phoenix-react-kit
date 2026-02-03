import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import express from 'express'
import { createServer as createViteServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let templateCache: string | null = null

function extractInlineModuleScripts(html: string) {
  const scripts: string[] = []
  const scriptTag = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null = null
  while ((match = scriptTag.exec(html)) !== null) {
    const attrs = match[1] ?? ''
    const body = match[2] ?? ''
    if (!/\btype\s*=\s*["']module["']/i.test(attrs)) continue
    if (/\bsrc\s*=/.test(attrs)) continue
    const trimmed = body.trim()
    if (trimmed.length === 0) continue
    scripts.push(trimmed)
  }
  return scripts
}

async function watchStdin() {
  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  for await (const chunk of process.stdin) {
    console.log(`[stdin] ${chunk.trim()}`)
  }

  process.exit(0)
}

async function createServer() {
  const app = express()

  // Create Vite server in middleware mode and configure the app type as
  // 'custom', disabling Vite's own HTML serving logic so parent server
  // can take control
  const vite = await createViteServer({
    root: __dirname,
    configFile: path.resolve(__dirname, "vite.config.js"),
    mode: "development",
    server: { middlewareMode: true },
    appType: "custom",
  })

  // Use vite's connect instance as middleware. If you use your own
  // express router (express.Router()), you should use router.use
  // When the server restarts (for example after the user modifies
  // vite.config.js), `vite.middlewares` is still going to be the same
  // reference (with a new internal stack of Vite and plugin-injected
  // middlewares). The following is valid even after restarts.
  app.use(vite.middlewares)

  app.use('*all', async (request, response, next) => {
    try {
      if (templateCache == null) {
        templateCache = fs.readFileSync(
          path.resolve(__dirname, 'index.html'),
          'utf-8',
        )
      }
      let template = await vite.transformIndexHtml(request.originalUrl, templateCache, request.originalUrl)
      template = template.replace('"/@react-refresh"', '"http://localhost:4100/@react-refresh"')
      const inlineModuleScripts = extractInlineModuleScripts(template)
      const { render } = await vite.ssrLoadModule('/src/entry.server.tsx')
      await render(request, response, inlineModuleScripts)
    } catch (e) {
      if (e instanceof Error) {
        vite.ssrFixStacktrace(e)
      }
      next(e)
    }
  })

  const port = 4100
  watchStdin()
  app.listen(port)
  console.info(`Starting Vite server on port ${port}`)
}

createServer()
