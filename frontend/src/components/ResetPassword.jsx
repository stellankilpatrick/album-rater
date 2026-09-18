import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../api/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!token) setStatus('no-token');
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) return setStatus('short');
    if (password !== confirm) return setStatus('mismatch');
    setStatus('loading');
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setStatus('done');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  if (status === 'no-token') return <div style={{ color: 'white', padding: 20 }}>Missing reset token.</div>;

  return (
    <div style={{ maxWidth: 480, margin: '24px auto', color: 'white' }}>
      <h2>Create a new password</h2>
      {status === 'done' ? (
        <div>Password updated. Redirecting…</div>
      ) : (
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 8 }}>New password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #333', marginBottom: 12 }} />
          <label style={{ display: 'block', marginBottom: 8 }}>Confirm password</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #333', marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="submit" style={{ padding: '8px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6 }}>Set password</button>
            {status === 'loading' && <span>Saving…</span>}
            {status === 'short' && <span style={{ color: '#f87171' }}>Password too short</span>}
            {status === 'mismatch' && <span style={{ color: '#f87171' }}>Passwords do not match</span>}
            {status === 'error' && <span style={{ color: '#f87171' }}>Failed to reset</span>}
          </div>
        </form>
      )}
    </div>
  );
}
