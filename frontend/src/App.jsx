import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import { LiveProvider } from './context/LiveContext.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import LiveData from './pages/LiveData.jsx'
import MachineDetail from './pages/MachineDetail.jsx'
import Reports from './pages/Reports.jsx'
import Alarms from './pages/Alarms.jsx'
import Profile from './pages/Profile.jsx'
import Devices from './pages/Devices.jsx'

function Protected({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <LiveProvider>{children}</LiveProvider>
}

export default function App() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="live" element={<LiveData />} />
        <Route path="live/:machineId" element={<MachineDetail />} />
        <Route path="reports" element={<Reports />} />
        <Route path="alarms" element={<Alarms />} />
        <Route path="devices" element={<Devices />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
