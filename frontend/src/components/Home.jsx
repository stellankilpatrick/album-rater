import { Link } from "react-router-dom";

export default function Home({ user }) {
  return (
    <div style={{ padding: "32px", textAlign: "center" }}>
      <h1 style={{ fontSize: "2.5rem", marginBottom: "12px" }}>
        Album Rater
      </h1>

      <p style={{ color: "#666", marginBottom: "24px" }}>
        Rate albums. Track your taste. Discover what others love.
      </p>

      {user ? (
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <Link to="/community">
            <button>Community</button>
          </Link>
          <Link to={`/users/${user.username}`}>
            <button>My Profile</button>
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <Link to="/login">
            <button>Login</button>
          </Link>
          <Link to="/register">
            <button>Sign Up</button>
          </Link>
        </div>
      )}
    </div>
  );
}