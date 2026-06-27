import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('landlink_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('landlink_token')
      localStorage.removeItem('landlink_user')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    if (err.response?.status === 429) {
      const msg = err.response?.data?.message
      if (msg) err.message = msg
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  verifyToken: (data) => api.post('/auth/verify-token', data),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/user/profile', data),
  getSettings: () => api.get('/user/settings'),
  updateTheme: (theme) => api.put('/user/theme', { theme }),
  updateLanguage: (language) => api.put('/user/language', { language }),
  updateNotifications: (notifications) => api.put('/user/notifications', { notifications }),
  uploadAvatar: (file, onProgress) => {
    const form = new FormData();
    form.append('avatar', file);
    return api.post('/user/avatar', form, {
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
  },
  changePassword: (data) => api.put('/user/password', data),
}

export const settingsApi = {
  getSettings: () => api.get('/settings'),
  updateSetting: (key, value) => api.post('/settings', { key, value }),
}

export const projectsApi = {
  list: () => api.get('/projects'),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  uploadLayout: (id, file, onProgress) => {
    const form = new FormData()
    form.append('file', file, file.name || 'layout.pdf')
    return api.post(`/projects/${id}/layout`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    })
  },
  uploadPdf: (id, file, onProgress) => {
    const form = new FormData()
    form.append('file', file, file.name || 'layout.pdf')
    return api.post(`/projects/${id}/upload-pdf`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    })
  },
  getLayout: (id) => api.get(`/projects/${id}/layout`),
  processLayout: (id, file, replace = false) => {
    const form = new FormData()
    form.append('file', file, file.name || 'layout.png')
    if (replace) form.append('replace', 'true')
    return api.post(`/projects/${id}/layout/process`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
    })
  },
  getPlotsMap: (id) => api.get(`/projects/${id}/plots-map`),
  inviteBroker: (id, data) => api.post(`/projects/${id}/invite-broker`, data),
  updateBrokerInvite: (id, brokerId, data) => api.put(`/projects/${id}/brokers/${brokerId}/invite`, data),
  resendBrokerInvite: (id, brokerId) => api.post(`/projects/${id}/brokers/${brokerId}/resend`),
  revokeBroker: (id, brokerId) => api.delete(`/projects/${id}/brokers/${brokerId}`),
  inviteCoOwner: (id, data) => api.post(`/projects/${id}/invite-coowner`, data),
  analytics: (id) => api.get(`/projects/${id}/analytics`),
  dashboardAnalytics: (params) => api.get('/analytics/overview', { params }),
  generatePlots: (id, data) => api.post(`/projects/${id}/plots/generate`, data),
  getMapData: (id) => api.get(`/projects/${id}/map-data`),
  updateMapData: (id, mapData) => api.put(`/projects/${id}/map-data`, { mapData }),
  parsePdf: (id) => api.post(`/projects/${id}/parse-pdf`),
  getMap: (id) => api.get(`/projects/${id}/map`),
  savePlotsBulk: (id, plots) => api.post(`/projects/${id}/plots-bulk`, { plots }),
  autoDetectPlots: (id) => api.post(`/projects/${id}/auto-detect-plots`),
  confirmAutoPlots: (id, plots) => api.post(`/projects/${id}/confirm-plots`, { plots }),
  updatePlot: (id, plotId, data) => api.put(`/projects/${id}/plots/${plotId}`, data),
  getPreview: (id) => api.get(`/projects/${id}/detected-plots-preview`),
  extractTable: (id, file) => {
    if (file) {
      const formData = new FormData();
      formData.append('image', file);
      return api.post(`/projects/${id}/extract-table`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,
      });
    }
    return api.post(`/projects/${id}/extract-table`, null, { timeout: 180000 });
  },
  analyzeLayout: (projectId, formData) =>
    api.post(`/projects/${projectId}/analyze-layout`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
    }),
  getPlots: async (projectId) => {
    const res = await api.get(`/projects/${projectId}/plots`);
    return res.data;
  },
  setPricePerCent: async (projectId, pricePerCent) => {
    const res = await api.patch(`/projects/${projectId}/price-per-cent`, { pricePerCent });
    return res.data;
  },
  updatePlotStatus: async (projectId, plotId, status) => {
    const res = await api.patch(`/projects/${projectId}/plots/${plotId}/status`, { status });
    return res.data;
  },
  delete: (id) => api.delete(`/projects/${id}`),
  deleteLayout: (id) => api.delete(`/projects/${id}/layout`),
  listPendingInvitations: () => api.get('/projects/invitations/pending'),
  getInvitation: (id) => api.get(`/projects/${id}/invitation`),
  acceptInvitation: (id) => api.post(`/projects/${id}/brokers/accept`),
  declineInvitation: (id) => api.post(`/projects/${id}/brokers/decline`),
}

export const analyticsApi = {
  overview: (params) => api.get('/analytics/overview', { params }),
  charts: (params) => api.get('/analytics/charts', { params }),
  broker: (id, params) => api.get(`/analytics/broker/${id}`, { params }),
  export: () => api.get('/analytics/export', { responseType: 'blob' }),
}

export const plotsApi = {
  list: (projectId) => api.get(`/plots/projects/${projectId}/plots`),
  bulkCreate: (projectId, plots) => api.post(`/plots/projects/${projectId}/plots`, { plots }),
  update: (id, data) => api.put(`/plots/${id}`, data),
  hold: (id) => api.post(`/plots/${id}/hold`),
  releaseHold: (id) => api.delete(`/plots/${id}/hold`),
}

export const bookingsApi = {
  list: (params) => api.get('/bookings', { params }),
  create: (data) => api.post('/bookings', data),
  approve: (id) => api.put(`/bookings/${id}/approve`),
  reject: (id, reason) => api.put(`/bookings/${id}/reject`, { reason }),
  complete: (id) => api.put(`/bookings/${id}/complete`),
}

export const documentsApi = {
  list: (projectId) => api.get(`/documents/projects/${projectId}/documents`),
  upload: (projectId, formData, onProgress) =>
    api.post(`/documents/projects/${projectId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    }),
  view: (id) => api.get(`/documents/${id}/view`),
  delete: (id) => api.delete(`/documents/${id}`),
}

export const notificationsApi = {
  list: () => api.get('/notifications'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
  clearAll: () => api.delete('/notifications'),
}

export const publicApi = {
  stats: () => api.get('/public/stats'),
}

export const subscriptionApi = {
  createOrder: (planKey) => api.post('/subscription/create-order', { planKey }),
  verify: (data) => api.post('/subscription/verify', data),
  devUpgrade: (plan) => api.post('/subscription/dev-upgrade', { plan }),
}

export default api
