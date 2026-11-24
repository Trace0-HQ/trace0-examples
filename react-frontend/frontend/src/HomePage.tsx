import { useEffect, useState } from 'react';

function HomePage() {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-clear the response message 3 seconds after it's set.
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  // Auto-clear the error message 3 seconds after it's set.
  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  async function handleCallBackend() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/hello');
      const data = await response.json();
      setMessage(data.message);
    } catch (err) {
      setMessage('Request failed. See the browser console for details.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleSimulateError() {
    setErrorMessage('Error generated!');
    
    // Throw asynchronously so the error is uncaught by React and reaches
    // window's global error event, where ErrorsInstrumentation (registered
    // in otel.ts) captures it. No try/catch or manual recordException() needed.
    setTimeout(() => {
      throw new Error('Something went wrong!');
    });
  }

  return (
    <>
      <p>
        This sample app demonstrates frontend observability with Trace0.
      </p>
      <p>
        Click <strong>Call Backend API</strong> to call the Node.js backend and see the end-to-end frontend-to-backend trace appear as a transaction in Trace0.
      </p>
      <p>
        Click <strong>Simulate Error</strong> to trigger an uncaught error and see it reported as a failing transaction.
      </p>
      <button onClick={handleCallBackend} disabled={loading}>
        {loading ? 'Calling backend…' : 'Call Backend API'}
      </button>{' '}
      <button onClick={handleSimulateError}>Simulate Error</button>
      {message && <p>Response: {message}</p>}
      {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
    </>
  );
}

export default HomePage;
