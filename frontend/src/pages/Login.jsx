import api from "../lib/api"

export default function Login() {
  const handleGoogleLogin = () => {
    window.location.href = api.get('/auth/google') ;
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>MeetingMind</h1>
        <p>Turn meetings into action, automatically.</p>
        <button onClick={handleGoogleLogin} className="google-btn">
          Sign in with Google
        </button>
      </div>
    </div>
  );
}