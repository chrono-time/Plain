import 'dotenv/config'
import React from 'react'
import Fastify from 'fastify'
import ip from 'ip'
import path from 'path'
import chalk from 'chalk'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import serveHandler from 'serve-handler'
import { processNewIndexFile, readIndexFile, renderToString, SSRManager } from '../library/server/index.js'
import serverFunctions from './methods/mainMethods.js'
import Render from '../src/render.jsx'
import { ChunkCollectorProvider } from '../library/server/chunkCollector.jsx'
import fs from 'fs'
import tailwindcss from "@tailwindcss/vite";
import { toNodeHandler } from "better-auth/node";
import { MetaTagManager, MetaTagProvider } from '../library/client/serverCallHandler.jsx'
import { SSRProvider } from '../library/server/ssrContext.jsx'
import cors from '@fastify/cors'
import svgr from 'vite-plugin-svgr'



const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const __public_directory = path.resolve(process.env.NODE_COMPILE == 'split' ? (__dirname, '..', 'public')  : (__dirname, '..', 'dist'))
let clientEnvs = {}
for(const key in process.env) {
  if(key.startsWith('REACT_APP_')){
    clientEnvs[key] = process.env[key]
  }
  if(key == 'NODE_COMPILE'){
    clientEnvs[key] = process.env[key]
  }
}

const buildViteServer = async () => {
     try {
       await build({
        configFile: false,  
        root: path.join(__dirname, '..'),  
        publicDir: false, 
        plugins: [react({
          jsxRuntime: 'automatic',
        }), tailwindcss(),
        svgr({
          include: ['**/*.svg'],

        })
      ],
        logLevel: 'silent',
        build: {
          manifest: true,
          outDir: path.join(__dirname, '..', 'dist'),        
          minify: false,  
          rollupOptions: {
            input: path.join(__dirname, '..', 'src', 'main.jsx'),
            output: {
              entryFileNames: '_assets/[name].js',
              chunkFileNames: '_assets/[name].js',
              assetFileNames: '_assets/[name].[ext]'
            },
            external: ['path', 'url', 'node:util']
          },
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, '..', "src"),
          },
        },
        define: {
          'process.env': clientEnvs,
        }
      })
    } catch (error) {
      console.error(error)
      
    }
  }

if(process.env.NODE_COMPILE == 'split'){
  if(!fs.existsSync('dist/.vite/manifest.json') || !fs.existsSync('dist/.vite/static-paths.json')){
    await buildViteServer()
  }
}

const manifest = JSON.parse(fs.readFileSync('dist/.vite/manifest.json'));
const staticPathsPath = 'dist/.vite/static-paths.json';
const staticPaths = fs.existsSync(staticPathsPath)
  ? JSON.parse(fs.readFileSync(staticPathsPath))
  : {};


readIndexFile(process.env.NODE_COMPILE == 'split' ? './src/index.html' : './dist/src/index.html')

const fastify = Fastify({
  logger: {
    level: 'warn',
    hooks: {
      logMethod(inputArgs, method) {
        const [msg] = inputArgs
        if (typeof msg === 'string' && msg.includes('Server listening at')) return
        if (typeof msg !== 'string' && String(msg).includes("Error")) {
          console.error(msg)
          return
        }
        method.apply(this, inputArgs)
      }
    }
  }
})

fastify.register(cors, {
  origin: (origin, callback) => {
    if (/https:\/\/.*\.mycampusgo\.com/.test(origin)) {
      return callback(null, true);
    }
    if (!origin || process.env.CORS_ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    console.log(`CORS error: ${origin} is not allowed`);
    callback(new Error("Not allowed by CORS"), false);
  },
  credentials: true,
});



// await fastify.register(authPlugin)
fastify.register(async function (instance, opts) {
    instance.addContentTypeParser(
      "application/json",
      (_request, _payload, done) => {
        done(null, null);
      },
    );

    instance.all('*', async (request, reply) => {
      const headersRecordToMap = (
        headers
    ) => {
        const entries = Object.entries(headers);
        const map= new Map();
        for (const [headerKey, headerValue] of entries) {
            if (headerValue != null) {
                map.set(headerKey, headerValue);
            }
        }
        return map;
    };
      reply.raw.setHeaders(headersRecordToMap(reply.getHeaders()));
      await toNodeHandler(auth)(request.raw, reply.raw);
    });
}, { prefix: '/api/auth', });




fastify.post('/ssr', async (req, reply) => {

  const ssrManager = new SSRManager(serverFunctions)

  const results = await ssrManager.ssrMethod(req.body.id, req.body.method, req.body.data)
  return reply.send(results)
  
  })

// Main handler for SSR
fastify.get('*', async (req, reply) => {
  try {
    if (req.url.match(/.*\/[^?]+\..+?(\?.*)?$/) || req.url.includes('.well-known')) {

      if(process.env.NODE_COMPILE == 'split' && req.url.includes('_assets')){        
        await serveHandler(req.raw, reply.raw, {
          public: path.join(__dirname, '..', 'dist'),
        })
        return
      }
      await serveHandler(req.raw, reply.raw, {
        public: __public_directory,
        dotfiles: 'allow'  // This option permits dotfiles to be served.
        
      })
      
      return
    }

  if(process.env.NODE_COMPILE == 'split'){
    try {
      await buildViteServer()
    } catch (error) {
      console.error(error)
      reply.code(500).send('Internal Server Error')
    }
  
  }

  
  const ssrManager = new SSRManager(serverFunctions)
  
const chunkCollector = {
    chunks: new Set(),
    add: (chunk) => {chunkCollector.chunks.add(chunk)},
    getLinks: () => {
      const manifest = JSON.parse(fs.readFileSync('dist/.vite/manifest.json'));


      // Initialize an array to store CSS file paths
      let cssFiles = [];
      if(process.env.NODE_COMPILE != 'production'){
        for(let chunkKey in manifest){
          const entry = manifest[chunkKey];
          if (entry && entry.isEntry == true) {
            if(entry.css){
              entry.css.forEach(cssFile => {
                let link = `<link rel="stylesheet" href="/${cssFile}">`;
                cssFiles.push(link);
              });
            }
            break
          }
        }
      }



      Array.from(chunkCollector.chunks).forEach(chunkKey => {
        const entry = manifest[chunkKey];
    
        if (entry && entry.css) {
          entry.css.forEach(cssFile => {
            let link = `<link rel="stylesheet" href="/${cssFile}" />`;

            cssFiles.push(link);
          });
        }
      });
    
      return cssFiles.join('\n');
    },
     
    getScripts: () => {
      let jsFiles = [];
      Array.from(chunkCollector.chunks).forEach(chunkKey => {
        const entry = manifest[chunkKey];
      
        if (entry && entry.file) {
          let script = `<script type="module" src="/${entry.file}"></script>`;
          jsFiles.push(script);
        }
        else{
          const staticEntry = staticPaths[chunkKey];
          if (staticEntry) {
            let script = `<script type="module" src="/${staticEntry}"></script>`;
            jsFiles.push(script);
          }
        }
      });

    
      return jsFiles.join('\n');
    }
  };



  
  let metaTagManager = new MetaTagManager()
  // Wrap your app with ChunkCollectorProvider so that loadable components register themselves.

    const jsx = (
    <SSRProvider ssrManager={ssrManager}>
      <MetaTagProvider manager={metaTagManager}>
      <ChunkCollectorProvider collector={chunkCollector}>
          <Render url={req.url} />
      </ChunkCollectorProvider>
      </MetaTagProvider>
    </SSRProvider>
  );



    const appString = await renderToString(jsx)


    const serverResponseScript = `
      <script>
        window.serverStore = ${ssrManager.getStoreScript()};
      </script>
    `    
      const finalHTML = processNewIndexFile({
      bodyContent: appString,
      scripts: [chunkCollector.getScripts()],
      head: [serverResponseScript, chunkCollector.getLinks(), metaTagManager.getFullHead() ],
    })

    return reply.type('text/html').send(finalHTML)
  } catch (err) {
    fastify.log.error(err)
    return reply.code(500).send('Internal Server Error')
  }
})

// Server initialization with cleanup handling
async function startServer() {
  let buildContext
  
  try {
    // buildContext = await initializeBuild()
  
    const port = process.env.PORT
    await fastify.listen({ port, host: '0.0.0.0' })

    const localAddress = chalk.bold.green(`http://localhost:${port}`)
    const networkAddress = chalk.bold.cyan(`http://${ip.address()}:${port}`)

    const viteLocalAddress = chalk.bold.green(`http://localhost:3000`)
    const viteNetworkAddress = chalk.bold.cyan(`http://${ip.address()}:3000`)

    if(process.env.NODE_COMPILE == 'split'){
      console.log(chalk.bold.bgBlueBright.white(' Vite Host '))
      console.log(`🌐 Local:    ${viteLocalAddress}`)
      console.log(`🌐 Network:  ${viteNetworkAddress}\n`)
      
    }

    console.log(chalk.bold.bgBlueBright.white(' Server Host '))
    console.log(`🌐 Local:    ${localAddress}`)
    console.log(`🌐 Network:  ${networkAddress}\n`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }

  // Cleanup on process termination
  process.on('SIGTERM', async () => {
    if (buildContext && typeof buildContext.dispose === 'function') {
      await buildContext.dispose()
    }
    process.exit(0)
  })
}

startServer()