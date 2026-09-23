// AETHER — routes. Auth-gated shell with Layout.
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Protected from './components/Protected';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Oracle from './pages/Oracle';
import News from './pages/News';
import Portfolio from './pages/Portfolio';
import StockDetail from './pages/StockDetail';
import Studio from './pages/Studio';
import Admin from './pages/Admin';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <Protected>
            <Layout>
              <Dashboard />
            </Layout>
          </Protected>
        }
      />
      <Route
        path="/oracle"
        element={
          <Protected>
            <Layout>
              <Oracle />
            </Layout>
          </Protected>
        }
      />
      <Route
        path="/news"
        element={
          <Protected>
            <Layout>
              <News />
            </Layout>
          </Protected>
        }
      />
      <Route
        path="/portfolio"
        element={
          <Protected>
            <Layout>
              <Portfolio />
            </Layout>
          </Protected>
        }
      />
      <Route
        path="/stock/:ticker"
        element={
          <Protected>
            <Layout>
              <StockDetail />
            </Layout>
          </Protected>
        }
      />
      <Route
        path="/studio"
        element={
          <Protected>
            <Layout>
              <Studio />
            </Layout>
          </Protected>
        }
      />
      <Route
        path="/admin"
        element={
          <Protected>
            <Layout>
              <Admin />
            </Layout>
          </Protected>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
