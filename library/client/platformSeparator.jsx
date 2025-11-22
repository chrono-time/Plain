import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useLocation, Outlet } from 'react-router-dom';

/**
 * SectionIsolationWrapper component to isolate sections and reload the page if the section changes.
 *
 * @param {Object} props - The properties object.
 * @param {string} props.section - The current section to be isolated.
 * @param {React.ReactNode} props.children - The children components to be rendered.
 * @returns {React.ReactNode} The rendered children components or null based on the section isolation logic.
 */

export const SectionIsolationWrapper = ({ section, children }) => {
  const location = useLocation()
  const [lastSection, setLastSection] = useLastSection()


  useEffect(() => {
    if(lastSection != null && lastSection !== section){
        window.location.reload()
    }
    else{
        setLastSection(section)
    }
  }, [location]);


  
  return (
    <>
        {
            (() => {
                if(typeof window === 'undefined'){
                    return children
                }
                else{
                    if(lastSection === section || lastSection === null){
                        return children
                    }
                }
            })()
        }
    </>
  )
    
  
};



const SectionIsolationContext = createContext();

export const SectionIsolationProvider = ({ children }) => {
  const [lastSection, setLastSection] = useState(null);

  return (
    <SectionIsolationContext.Provider value={{ lastSection, setLastSection }}>
       <Outlet />
    </SectionIsolationContext.Provider>
  );
};

export const useLastSection = () => {
  const context = useContext(SectionIsolationContext);
  return [context.lastSection, context.setLastSection];
};


