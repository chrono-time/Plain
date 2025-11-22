import React from 'react';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { StaticRouter } from "react-router-dom/server";
import { useEffect } from 'react';
import { MetaTagProvider } from '../library/client/serverCallHandler';
import './css/index.css'
import './css/materialFonts.css'

//Add global CSS here



const Render = ({ url }) => {

  if (typeof window == 'undefined') {
    return (
        <StaticRouter location={url}>
          <App />
        </StaticRouter>
    )
  }
  else {
    return (
         <MetaTagProvider>
            <BrowserRouter>
              <App />
          </BrowserRouter>
        </MetaTagProvider>     
    )
  }



}

export default Render