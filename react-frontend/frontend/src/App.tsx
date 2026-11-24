import { Link, Outlet } from 'react-router';
import RouteTracker from './RouteTracker';

// Shared layout for every route, rendered by the root route in main.tsx.
// RouteTracker needs to live inside the data router's tree (it calls
// useMatches()), so it's here rather than wrapping the router itself.
function App() {
  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 640, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>React Frontend Example</h1>
      <nav>
        <Link to="/">Home</Link> | <Link to="/about">About</Link>
      </nav>
      <RouteTracker />
      <Outlet />
    </main>
  );
}

export default App;
