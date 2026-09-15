import { Link } from "react-router-dom";

export default function Help() {
    return (
        <div style={{ padding: 24, maxWidth: 920 }}>
            <h1>Welcome to aarva — Quick Start & FAQ</h1>

            <section style={{ marginTop: 20 }}>
                <h2>Quick Start</h2>
                <ol>
                    <li>Create an account or sign in using the <strong>Login</strong> page.</li>
                    <li>Use <strong>Add Project</strong> to add projects to your library.</li>
                    <li>Rate songs to influence album ratings and share activity with friends.</li>
                    <li>Visit the <Link to="/community">Activity</Link> page to see what friends are listening to.</li>
                </ol>
            </section>

            <section style={{ marginTop: 20 }}>
                <h2>Frequently Asked Questions</h2>

                <h3>What do the song ratings mean?</h3>
                <p>Songs are grouped into four categories. A "play" is a track you enjoy listening to. A "skip" is a track you skip over, self explanatory. A "favorite" is a track you love that is better than just a "play". An "interlude" is any track that serves as a transitional or filler piece within the album.</p>

                <h3>How are project ratings calculated?</h3>
                <p>An algorithm that weights efficiency (what percentage of songs do you like in the project) and raw volume (how many songs do you like in the project) to calculate the overall album rating.</p>

                <h3>What is custom adjustor?</h3>
                <p>A way to fine tune an project's calculated rating. In case the algorithm's assessment doesn't fully reflect your personal opinion, you can use the custom adjustor to manually adjust the rating.</p>

                <h3>What are the types of projects?</h3>
                <p>Projects can be categorized into albums, EPs, compilations, soundtracks, live albums, and singles. 
                    Albums are full-length releases, EPs are shorter collections of songs, 
                    compilations are curated collections from various sources, soundtracks accompany visual media, 
                    live albums capture performances, and singles are individual song releases.
                    When creating a project in <b>Add Project</b>, you will select the type of project and provide relevant details such as title, artist, release date, and tracklist.</p>

                <h3>How do I change my ratings?</h3>
                <p>You can change your rating by visiting a project and updating the song ratings.</p>

                <h3>Why can't I see my friend's activity?</h3>
                <p>Make sure you follow them and that they have recent activity (ratings/updates) within the last month. Also check your network connection.</p>

                <h3>Can I import my library?</h3>
                <p>Not currently. You can add projects manually via the <strong>Add Project</strong> form.</p>
            </section>

            <section style={{ marginTop: 20 }}>
                <h2>Tips</h2>
                <ul>
                    <li>Use the search bar to find projects, songs, or artists quickly.</li>
                    <li>Click the star icons to switch between star and numeric rating modes.</li>
                </ul>
            </section>

            <div style={{ marginTop: 28 }}>
                <Link to="/">Back to Home</Link>
            </div>
        </div>
    );
}
