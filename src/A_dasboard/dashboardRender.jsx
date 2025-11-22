import { Meta } from "../../library/client/serverCallHandler";
import DashboardApp from "./dashboardApp";

//Add Dashboard CSS here

const DashboardRender = () => {
    return (

        <>
            <Meta>
                <title>VoiceScout - Find your voice</title>
                <meta name="description" content="VoiceScout is a platform to find voice actors for your projects."></meta>
                <meta name="keywords" content="voice, voiceover, voice actor, voice talent, casting, auditions, demo reels, voiceover marketplace"></meta>
                <meta name="author" content="VoiceScout"></meta>
                <meta name="viewport" content="width=device-width, initial-scale=1.0"></meta>
            </Meta>
            <DashboardApp />
        
        </>
    )
}

export default DashboardRender;