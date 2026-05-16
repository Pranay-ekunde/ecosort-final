import axios from "axios";

// In dev: VITE_API_URL is undefined → baseURL = "/api" → Vite proxy handles it
// In prod: set VITE_API_URL=https://your-backend.onrender.com in Vercel env vars
const api = axios.create({ baseURL: (import.meta.env.VITE_API_URL || "") + "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  register:       (d)  => api.post("/auth/register", d),
  login:          (d)  => api.post("/auth/login", d),
  me:             ()   => api.get("/auth/me"),
  changePassword: (d)  => api.put("/auth/change-password", d),
};

export const scanAPI = {
  classify:   (form)   => api.post("/scans/classify", form, { headers: { "Content-Type": "multipart/form-data" } }),
  getAll:     (params) => api.get("/scans", { params }),
  getRecent:  ()       => api.get("/scans/recent"),
  getLimits:  ()       => api.get("/scans/limits"),
  getOne:     (id)     => api.get(`/scans/${id}`),
  delete:     (id)     => api.delete(`/scans/${id}`),
};

export const analyticsAPI = {
  summary:  ()      => api.get("/analytics/summary"),
  monthly:  (months)=> api.get("/analytics/monthly", { params: { months } }),
  global:   ()      => api.get("/analytics/global"),
};

export const rewardAPI = {
  balance: ()       => api.get("/rewards/balance"),
  history: (params) => api.get("/rewards", { params }),
};

export const couponAPI = {
  catalogue: ()    => api.get("/coupons/catalogue"),
  redeem:    (idx) => api.post("/coupons/redeem", { catalogueIndex: idx }),
  my:        (s)   => api.get("/coupons/my", { params: { status: s } }),
  use:       (code)=> api.post(`/coupons/use/${code}`),
  validate:  (code)=> api.get(`/coupons/validate/${code}`),
};

export const leaderboardAPI = {
  overall: () => api.get("/leaderboard"),
  weekly:  () => api.get("/leaderboard/weekly"),
};

export const adminAPI = {
  stats:       ()       => api.get("/admin/stats"),
  analytics:   (days)   => api.get("/admin/analytics", { params: { days } }),
  system:      ()       => api.get("/admin/system"),
  users:       (params) => api.get("/admin/users", { params }),
  userDetail:  (id)     => api.get(`/admin/users/${id}`),
  updateUser:  (id, d)  => api.put(`/admin/users/${id}`, d),
  banUser:     (id)     => api.put(`/admin/users/${id}/ban`),
  unbanUser:   (id)     => api.put(`/admin/users/${id}/unban`),
  awardPoints: (id, d)  => api.post(`/admin/users/${id}/award-points`, d),
  scans:       (params) => api.get("/admin/scans", { params }),
  deleteScan:  (id)     => api.delete(`/admin/scans/${id}`),
  coupons:     (params) => api.get("/admin/coupons", { params }),
};

export default api;
