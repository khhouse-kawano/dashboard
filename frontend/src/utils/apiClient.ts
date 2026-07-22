import axios from 'axios';

const apiClient = axios.create({
    baseURL: 'https://khg-marketing.info/dashboard/api/gateway/',
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