import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import express from 'express'
import { createServer as createViteServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let templateCache: string | null = null

async function watchStdin() {
  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  for await (const chunk of process.stdin) {
    // Handle input here if needed
    console.log(`[stdin] ${chunk.trim()}`)
  }

  // This runs when stdin closes (e.g., parent process dies or pipe ends)
  console.log('stdin closed, exiting...')
  process.exit(0)
}

async function createServer() {
  const app = express()
  console.info(__dirname)

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

  app.use('*all', async (req, res, next) => {
  const url = req.originalUrl

  try {
    if (templateCache == null) {
      templateCache = fs.readFileSync(
        path.resolve(__dirname, 'index.html'),
        'utf-8',
      )
    }

    let template = await vite.transformIndexHtml(url, templateCache, req.originalUrl)
    const devOrigin = 'http://localhost:4100'
    template = template
      .replaceAll('from "/@', `from "${devOrigin}/@`)
      .replaceAll('src="/@', `src="${devOrigin}/@`)
      .replaceAll('href="/@', `href="${devOrigin}/@`)
      .replaceAll('href="/vite.svg"', `href="${devOrigin}/vite.svg"`)
      .replaceAll('src="/vite.svg"', `src="${devOrigin}/vite.svg"`);

    const { render } = await vite.ssrLoadModule('/src/entry.server.tsx')
    const {html, head} = await render(req)
    res.status(200).set({ 'Content-Type': 'text/html' }).end(template.replace(`<!--ssr-body-->`, html).replace('<!--ssr-head-->', head))
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