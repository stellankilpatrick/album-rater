import axios from "axios";

const api = axios.create({
    // Set in frontend/.env.development (npm start) and .env.production (npm run build)
    baseURL: process.env.REACT_APP_API_URL || "http://localhost:3000",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;