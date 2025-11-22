import { proxy } from 'valtio'
import {devtools} from 'valtio/utils'

const initialState = {
    example:null
    
}

export const mainProxy = proxy(initialState)
const unsub = devtools(mainProxy, {
    name: 'Main Proxy',
    enabled: process.env.NODE_COMPILE == 'split',
})

export const resetMainProxy = () => {
    for (const key in mainProxy) {
        delete mainProxy[key];
    }
    Object.assign(mainProxy, structuredClone(initialState))
}