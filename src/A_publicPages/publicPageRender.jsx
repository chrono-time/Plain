import { Meta } from "../../library/client/serverCallHandler";
import PublicPageApp from "./publicPageApp"

//Add landing page CSS here

const PublicPageRender = () => {
    return (

        <>
            <Meta>
                <title>VoiceScout - Find your voice</title>
                <meta name="description" content="VoiceScout is a platform to find voice actors for your projects."></meta>
                <meta name="keywords" content="voice, voiceover, voice actor, voice talent, casting, auditions, demo reels, voiceover marketplace"></meta>
                <meta name="author" content="VoiceScout"></meta>
                <meta name="viewport" content="width=device-width, initial-scale=1.0"></meta>
            </Meta>
            <PublicPageApp />
        
        </>
    )
}

export default PublicPageRender;