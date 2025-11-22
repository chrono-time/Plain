import React from 'react';
import fs from 'fs';
import { parse } from 'node-html-parser';
import _ from 'lodash';
import {prerenderToNodeStream} from 'react-dom/static'
import Module from "node:module";

const require = Module.createRequire(import.meta.url);
global.require = require;



let documentString = undefined

export const readIndexFile = (location) => {
    documentString = fs.readFileSync(location, 'utf-8');

    documentString = documentString.replace(
        /<script([^>]*)src=["'](?:\.\/)?(main)\.jsx["']([^>]*)><\/script>/g,
        '<script$1src="/_assets/$2.js"$3></script>'
      );
      
    
    return documentString;
};

/**
 * Processes a new index file based on provided scripts and head elements.
 * 
 * @param {Object} options - The options object.
 * @param {Array} options.scripts - An array of scripts to be processed.
 * @param {Array} options.head - An array of head elements to be processed.
 * @returns {typeof defaultRoot} - The processed default root.
 */

export const processNewIndexFile = ({ bodyContent, scripts, head }) => {
    if(!Array.isArray(scripts)){
        throw new Error("Scripts parameter must be an array")
    }

    if(!Array.isArray(head)){
        throw new Error("Head parameter must be an array")
    }

    let documentStringCopy = documentString
    documentStringCopy = documentStringCopy.replace(`<div id="root"></div>`, `<div id="root">${bodyContent}</div>`)


    let document = parse(documentStringCopy)


    for(let i=0; i < scripts.length; i++){
        document.getElementsByTagName('body')[0].insertAdjacentHTML('beforeend', scripts[i]) 
    }

    for(let i=0; i < head.length; i++){
        document.getElementsByTagName('head')[0].insertAdjacentHTML('beforeend', head[i]) 
    }
    let finalDocument = document.toString()

    return finalDocument


}



export async function renderToString(jsx) {
    const {prelude} = await prerenderToNodeStream(jsx);
    
    return new Promise((resolve, reject) => {
      let data = '';
      prelude.on('data', chunk => {
        data += chunk;
      });
      prelude.on('end', () => resolve(data));
      prelude.on('error', reject);
    });
  }


  export class SSRManager {
    constructor(apiMethods = {}) {
      this.store = {};
      this.apiMethods = apiMethods;
    }
    
    // Store data with a specific ID
    setDataInStore(id, data) {
      this.store[id] = {
        data,
        initial_data: true,
        timestamp: Date.now()
      };
      return data;
    }
    
    async ssrMethod(id, method, data) {
      if (this.store[id]) {
        return this.store[id].data;
      }
      
      if (this.apiMethods[method]) {
        try {
          const result = await this.apiMethods[method](data);
          // Store the result
          return this.setDataInStore(id, result);
        } catch (error) {
          console.error(`Error executing SSR method '${method}':`, error);
          throw error;
        }
      } else {
        throw new Error(`SSR method '${method}' not implemented`);
      }
    }
    
    // Get the serialized store for client hydration
    getStoreScript() {
      return JSON.stringify(this.store)
    }
  }
