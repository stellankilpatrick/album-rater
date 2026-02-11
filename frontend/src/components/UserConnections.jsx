import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import api from "../api/api";

export default function UserConnections() {
  const { username } = useParams();
  const location = useLocation();

  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);

  useEffect(() => {
    api.get(`/users/${username}/followers`)
      .then(res => setFollowers(res.data));

    api.get(`/users/${username}/following`)
      .then(res => setFollowing(res.data));
  }, [username]);

  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.substring(1));
      el?.scrollIntoView({ behavior: "smooth" });
    }
  }, [location.hash]);

  return (
    <div>
      <h1>{username}</h1>

      <h2 id="followers">Followers</h2>
      {followers.length === 0 && <div>No followers</div>}
      {followers.map(u => (
        <div key={u.id}>
          <Link to={`/users/${u.username}`} style={{ textDecoration: "none" }}>
            {u.username}
          </Link>
        </div>
      ))}

      <h2 id="following" style={{ marginTop: "24px" }}>Following</h2>
      {following.length === 0 && <div>Not following anyone</div>}
      {following.map(u => (
        <div key={u.id}>
          <Link to={`/users/${u.username}`} style={{ textDecoration: "none" }}>
            {u.username}
          </Link>
        </div>
      ))}
    </div>
  );
}