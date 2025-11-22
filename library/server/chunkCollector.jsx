import React, { createContext, useContext } from 'react';


export const ChunkCollectorContext = createContext({
  add: (chunk) => {},
});

export function ChunkCollectorProvider({ children, collector }) {
  return (
    <ChunkCollectorContext.Provider value={collector}>
      {children}
    </ChunkCollectorContext.Provider>
  );
}

function extractChunkNameFromFactory(factory) {
  const fnStr = factory.toString();
  const match = fnStr.match(/import\((?:'|")([^'"]+)(?:'|")\)/);
  if (match && match[1]) {
   try {

    let rootPathway = null
    if(typeof window === 'undefined'){
      const util = require('node:util')
      const path = require('node:path')
      const { fileURLToPath } = require('node:url')
      const callSites = util.getCallSites();
      let hit = false
      for(const callSite of callSites){
        if(callSite.functionName == 'loadable'){
          hit = true
        }
        else{
          if(hit){
            rootPathway = callSite.scriptName
            break
          }
        }      
      }
      const filePath = fileURLToPath(rootPathway);

      // Extract the directory (i.e. the working directory of this file).
      const workingDirectory = path.dirname(filePath);

      let pathwayRoot = workingDirectory
      let pathway = path.resolve(pathwayRoot, match[1])
      let finalPathway = pathway.replace(process.cwd(), '')
      finalPathway = finalPathway.replace(/^[\.\/\\]+/, '');
      finalPathway = finalPathway.replace(/\\/g, '/');
      return finalPathway
    }
    else{
      return match[1]
    }


     
   } catch (error) {
    console.log(error )
    return null
   }
  }
  return null;
}

export function loadable(modulePathOrFactory) {
  


  const factory =
    typeof modulePathOrFactory === 'string'
      ? () => import(/* @vite-ignore */modulePathOrFactory)
      : modulePathOrFactory;

  const LazyComponent = React.lazy(factory);

  const chunkName = extractChunkNameFromFactory(factory);

  return function WrappedLoadableComponent(props) {
    const collector = useContext(ChunkCollectorContext);
    if (collector && typeof collector.add === 'function' && chunkName) {
      collector.add(chunkName);
    }
    return <LazyComponent {...props} />;
  };
}
