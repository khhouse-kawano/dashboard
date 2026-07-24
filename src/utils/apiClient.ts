import axios from 'axios';
const baseURL = process.env.REACT_APP_XSERVER_API;
const apiClient = axios.create({
    baseURL,
    headers: { Authorization: '4081Kokubu', 'Content-Type': 'application/json' }
});

apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers['Token'] = token;
    }
    return config;
});

export default apiClient;