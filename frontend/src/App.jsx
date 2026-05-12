import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

// Layouts
import Layout      from "./components/Layout";
import AdminLayout from "./components/AdminLayout";

// Auth pages
import Login    from "./pages/Login";
import Register from "./pages/Register";

// User pages
import Dashboard   from "./pages/Dashboard";
import Classify    from "./pages/Classify";
import History     from "./pages/History";
import Analytics   from "./pages/Analytics";
import Rewards     from "./pages/Rewards";
import Coupons     from "./pages/Coupons";
import Leaderboard from "./pages/Leaderboard";
import Profile     from "./pages/Profile";

// Admin pages
import AdminOverview  from "./pages/AdminOverview";
import AdminUsers     from "./pages/AdminUsers";
import { AdminScans, AdminCoupons, AdminAnalytics, AdminSystem } from "./pages/AdminPages";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner" style={{ marginTop: 120 }} />;
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner" style={{ marginTop: 120 }} />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"    element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />

      {/* User app */}
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index              element={<Dashboard />} />
        <Route path="classify"    element={<Classify />} />
        <Route path="history"     element={<History />} />
        <Route path="analytics"   element={<Analytics />} />
        <Route path="rewards"     element={<Rewards />} />
        <Route path="coupons"     element={<Coupons />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="profile"     element={<Profile />} />
      </Route>

      {/* Admin panel */}
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index               element={<AdminOverview />} />
        <Route path="users"        element={<AdminUsers />} />
        <Route path="scans"        element={<AdminScans />} />
        <Route path="coupons"      element={<AdminCoupons />} />
        <Route path="analytics"    element={<AdminAnalytics />} />
        <Route path="system"       element={<AdminSystem />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
