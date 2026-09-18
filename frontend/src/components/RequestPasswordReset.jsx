import { useState } from "react";
import api from "../api/api";

export default function RequestPasswordReset() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");
    try {
      await api.post('/auth/request-password-reset', { email });
      setStatus('sent');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '24px auto', color: 'white' }}>
      <h2>Reset your password</h2>
      {status === 'sent' ? (
        <div>A password reset link has been sent if that email exists.</div>
      ) : (
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 8 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #333', marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" style={{ padding: '8px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6 }}>Send reset link</button>
            {status === 'error' && <span style={{ color: '#f87171' }}>Failed to send. Try again.</span>}
          </div>
        </form>
      )}
    </div>
  );
}
