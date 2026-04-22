import { useState } from "react";
import api from "../api/api";
import { useNavigate } from "react-router-dom";

export default function AuthPage({ onLogin }) {
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (isRegister && password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);
        try {
            const url = isRegister ? "/auth/register" : "/auth/login";
            const normalizedUsername = username.trim().toLowerCase();
            const body = isRegister
                ? { username: normalizedUsername, email: email.trim(), password }
                : { email: email.trim(), password };

            const res = await api.post(url, body);
            localStorage.setItem("token", res.data.token);
            onLogin(res.data.user, res.data.token);
            const loggedInUsername = res.data.user?.username ?? normalizedUsername;
            navigate(`/albums/users/${loggedInUsername}`);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const switchMode = () => {
        setIsRegister(!isRegister);
        setError("");
        setConfirmPassword("");
    };

    return (
        <div className="auth-page">
            <div className="auth-top-space">
                <h1 className="auth-app-title">Album Rater</h1>
            </div>
            <div className="auth-card">
                <h2 className="auth-title">{isRegister ? "Sign Up" : "Login"}</h2>
                <form className="auth-form" onSubmit={handleSubmit}>
                    {isRegister && (
                        <input
                            className="auth-input"
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    )}
                    <input
                        className="auth-input"
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <div className="auth-password-wrap">
                        <input
                            className="auth-input"
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <span className="auth-show-password" onClick={() => setShowPassword(p => !p)}>
                            {showPassword ? "Hide" : "Show"}
                        </span>
                    </div>
                    {isRegister && (
                        <div className="auth-password-wrap">
                            <input
                                className="auth-input"
                                type={showPassword ? "text" : "password"}
                                placeholder="Confirm Password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>
                    )}
                    <button className="auth-submit-btn" type="submit" disabled={loading}>
                        {loading ? <span className="auth-spinner" /> : (isRegister ? "Sign Up" : "Login")}
                    </button>
                    <p className="auth-delay-note">
                        Sign in may be delayed ~30 seconds after inactivity.
                    </p>
                    {error && <p className="auth-error">{error}</p>}
                </form>
                <p className="auth-switch">
                    {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
                    <button className="auth-switch-btn" onClick={switchMode}>
                        {isRegister ? "Login" : "Sign Up"}
                    </button>
                </p>
            </div>
            <div className="auth-bottom-space" />
        </div>
    );
}
