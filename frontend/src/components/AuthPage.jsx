import { useState } from "react";
import api from "../api/api";
import { useNavigate } from "react-router-dom";

export default function AuthPage({ onLogin }) {
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        try {
            const url = isRegister ? "/auth/register" : "/auth/login";
            const body = isRegister ? { username, email, password } : { email, password };

            const res = await api.post(url, body);
            
            localStorage.setItem("token", res.data.token); // store JWT

            // Save token and call parent handler
            onLogin(res.data.user, res.data.token);

            // redirect to albums page
            navigate(`/${username}/albums`);
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
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button type="submit">{isRegister ? "Sign Up" : "Login"}</button>
                {error && <p className="error">{error}</p>}
            </form>
            <p>
                {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
                <button onClick={() => setIsRegister(!isRegister)}>
                    {isRegister ? "Login" : "Sign Up"}
                </button>
            </p>
        </div>
    );
}