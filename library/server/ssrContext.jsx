import React, { createContext, useContext, useId } from 'react';

// Create a context for the SSR manager
const SSRContext = createContext(null);

// Provider component that makes SSR manager available to the app
export function SSRProvider({ ssrManager, children }) {
  return (
    <SSRContext.Provider value={ssrManager}>
      {children}
    </SSRContext.Provider>
  );
}

// Hook to access SSR manager
export function useSSRManager() {
  const context = useContext(SSRContext);
  if (!context && typeof window === 'undefined') {
    throw new Error('useSSRManager must be used within an SSRProvider');
  }
  return context;
}