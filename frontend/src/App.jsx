import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { DashboardLayout } from './components/Layout/DashboardLayout'
import OwnerLayout from './pages/owner/OwnerLayout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import OwnerDashboard from './pages/owner/Dashboard'
import Overview from './pages/owner/Overview'
import Projects from './pages/owner/Projects'
import ProjectNew from './pages/owner/ProjectNew'
import ProjectDetail from './pages/owner/ProjectDetail'
import OwnerSettings from './pages/owner/Settings'
import OwnerNotifications from './pages/owner/Notifications'
import OwnerBookings from './pages/owner/Bookings'
import OwnerAnalytics from './pages/owner/Analytics'
import OwnerDocuments from './pages/owner/Documents'
import OwnerBrokers from './pages/owner/Brokers'
import BrokerDashboard from './pages/broker/Dashboard'
import BrokerProjects from './pages/broker/Projects'
import ProjectView from './pages/broker/ProjectView'
import BrokerBookings from './pages/broker/Bookings'
import Earnings from './pages/broker/Earnings'
import BrokerSettings from './pages/broker/Settings'
import BrokerNotifications from './pages/broker/Notifications'
import BrokerInvitation from './pages/broker/Invitation'

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ThemeProvider>
          <SocketProvider>
            <BrowserRouter>
              <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<DashboardLayout role="owner" />}>
                  <Route index element={<Overview />} />
                  <Route path="projects" element={<Projects />} />
                  <Route path="projects/new" element={<ProjectNew />} />
                  <Route path="projects/:id" element={<ErrorBoundary><ProjectDetail /></ErrorBoundary>} />
                  <Route path="notifications" element={<OwnerNotifications />} />
                  <Route path="settings" element={<OwnerSettings />} />
                  <Route path="bookings" element={<OwnerBookings />} />
                  <Route path="analytics" element={<OwnerAnalytics />} />
                  <Route path="documents" element={<OwnerDocuments />} />
                  <Route path="brokers" element={<OwnerBrokers />} />
                </Route>
                <Route path="/broker" element={<DashboardLayout role="broker" />}>
                  <Route index element={<BrokerDashboard />} />
                  <Route path="projects" element={<BrokerProjects />} />
                  <Route path="projects/:id" element={<ProjectView />} />
                  <Route path="bookings" element={<BrokerBookings />} />
                  <Route path="earnings" element={<Earnings />} />
                  <Route path="notifications" element={<BrokerNotifications />} />
                  <Route path="invitations" element={<BrokerInvitation />} />
                  <Route path="invitations/:projectId" element={<BrokerInvitation />} />
                  <Route path="settings" element={<BrokerSettings />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </SocketProvider>
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  )
}

export default App
