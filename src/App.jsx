import React, { lazy, useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { loadable } from '../library/server/chunkCollector.jsx';
import { SectionIsolationProvider } from '../library/client/platformSeparator.jsx';
/* 
   Loadable components help split the react app into smaller chunks, good for ssr
*/


const DashboardRender = loadable(() => import('./A_dasboard/dashboardRender.jsx'))
const PublicPageRender = loadable(() => import('./A_publicPages/publicPageRender.jsx'))
/* 
    Mainapp is for a dashboard
    Public pages are for the landing pages of a website
*/


  

const App = () => {

    console.log(process.env)
    

    return (
        <>
            <Routes>
                <Route element={<SectionIsolationProvider />}>
                    <Route element={<SectionIsolationProvider/>} >
                        <Route path='/dashboard/*' element={<DashboardRender />} />
                    </Route>


                    <Route element={<SectionIsolationProvider/>} >
                        <Route path='/*' element={<PublicPageRender />} />
                    </Route>
                </Route>
            </Routes>
        </>


    )
};

export default App;
