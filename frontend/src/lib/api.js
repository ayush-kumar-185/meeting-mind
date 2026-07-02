import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.BACKEND_URL,
  withCredentials: true, // sends the httpOnly cookie
});

export default api;