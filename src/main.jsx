import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import Render from './render.jsx';

if (process.env.NODE_ENV === 'development') {
    let root;
    function render() {
        if (!root) {
            root = createRoot(document.getElementById('root'));
        }
        root.render(<Render />);
    }

    render();

    // Vite HMR handling
    if (import.meta.hot) {
        import.meta.hot.accept('./render.jsx', () => {
            render();
        });
    }
} else {
    hydrateRoot(document.getElementById('root'), <Render />);
}