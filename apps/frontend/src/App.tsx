import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [token, setToken] = useState(localStorage.getItem('authToken') || null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); // Clear past errors

    try {
      // Adjust the URL if your docker setup uses a different port/path
      const response = await fetch('/api/login/', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Main Flow: Save token to browser storage
        localStorage.setItem('authToken', data.token);
        setToken(data.token);
        alert('Logged in successfully!');
      } else {
        // Exception Flows: 3a (Invalid) or 3b (Locked)
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Cannot connect to backend service.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
  };

  // If already logged in, show a simple dashboard view
  if (token) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>🎉 Authenticated Dashboard</h2>
        <p>Your JWT Token is securely stored in your browser.</p>
        <button onClick={handleLogout}>Log Out</button>
      </div>
    );
  }

  // Otherwise, render the Login Form
  return (
    <div style={{ maxWidth: '300px', margin: '50px auto', textAlign: 'center' }}>
      <h2>System Login (UC_AUTH_01)</h2>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>
        <button type="submit" style={{ width: '100%', padding: '10px', cursor: 'pointer' }}>
          Login
        </button>
      </form>

      {error && <p style={{ color: 'red', marginTop: '15px' }}>{error}</p>}
    </div>
  );
}


export default App

