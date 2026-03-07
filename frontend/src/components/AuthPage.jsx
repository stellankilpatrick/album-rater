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
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (isRegister && password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        try {
            const url = isRegister ? "/auth/register" : "/auth/login";
            const normalizedUsername = username.trim().toLowerCase();
            const body = isRegister ? { username: normalizedUsername, email: email.trim(), password } : { email: email.trim(), password };

            const res = await api.post(url, body);
            localStorage.setItem("token", res.data.token);
            onLogin(res.data.user, res.data.token);
            navigate(`/${normalizedUsername}/albums`);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || "Something went wrong");
        }
    };

    return (
        <div className="auth-container">
            <h2>{isRegister ? "Sign Up" : "Login"}</h2>
            <form onSubmit={handleSubmit}>
                {isRegister && (
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                )}
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                {/* Password */}
                <div style={{ position: "relative", display: "inline-block" }}>
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{ paddingRight: "32px" }}
                    />
                    <span
                        onClick={() => setShowPassword(p => !p)}
                        style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", cursor: "pointer" }}
                    >
                        {showPassword ? "Hide" : "Show"}
                    </span>
                </div>

                {/* Confirm Password */}
                {isRegister && (
                    <div style={{ position: "relative", display: "inline-block" }}>
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            style={{ paddingRight: "32px" }}
                        />
                    </div>
                )}

                <p style={{ fontSize: "12px", color: "#999", margin: "4px 0" }}>
                    Sign in may be delayed around 30 seconds due to inactivity. Thank you for your patience.
                </p>
                <button type="submit">{isRegister ? "Sign Up" : "Login"}</button>
                {error && <p className="error">{error}</p>}
            </form>
            <p>
                {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
                <button onClick={() => { setIsRegister(!isRegister); setError(""); setConfirmPassword(""); }}>
                    {isRegister ? "Login" : "Sign Up"}
                </button>
            </p>
        </div>
    );
}