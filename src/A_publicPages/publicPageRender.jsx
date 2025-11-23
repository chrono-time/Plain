import { Meta } from "../../library/client/serverCallHandler";
import PublicPageApp from "./publicPageApp"

//Add landing page CSS here

const PublicPageRender = () => {
    return (

        <>
            <Meta>
                <title>Engineering Log — SSR-friendly blog layout</title>
                <meta name="description" content="A readable, server-first blog layout built with React Router that keeps routing and middleware under your control."></meta>
                <meta name="keywords" content="React SSR, blog layout, React Router, server rendering, hydration, engineering notes"></meta>
                <meta name="author" content="Engineering Log"></meta>
                <meta name="viewport" content="width=device-width, initial-scale=1.0"></meta>
            </Meta>
            <PublicPageApp />
        
        </>
    )
}

export default PublicPageRender;
