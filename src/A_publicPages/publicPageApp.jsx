import { Route, Routes } from "react-router-dom";



const PublicPageApp = () => {
    return (
        <Routes>
            <Route path="/" element={<div>Public Page</div>} />
        </Routes>
    )
}

export default PublicPageApp;