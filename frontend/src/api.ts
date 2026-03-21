import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = 'https://backend-one-zeta-51.vercel.app/';

async function getToken(): Promise<string | null>{
    return await AsyncStorage.getItem('idToken');
}

async function request(method: string, path: string, body?: object){
    const token = await getToken();

    const res = await fetch(`${BACKEND_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        ...(body && { body: JSON.stringify(body) }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Request failed');
    return data;
}

export const api = {
    signup: (email: string, password: string, displayName?: string) =>
      request('POST', '/auth/signup', { email, password, displayName }),
  
    login: async (email: string, password: string) => {
      const data = await request('POST', '/auth/login', { email, password });
      await AsyncStorage.setItem('idToken', data.idToken);
      await AsyncStorage.setItem('uid', data.uid);
      return data;
    },

    startSession: async () =>
        request('POST', '/sessions'),

    endSession: async (id: string, overallScore?: number, feedbackSummary?: string) =>
        request('PATCH', `/sessions/${id}/end`, { overallScore, feedbackSummary }),

    getSessions: async () =>
        request('GET', '/sessions'),

    getSession: async (id: string) =>
        request('GET', `/sessions/${id}`),

    logMetrics: async (sessionId: string, metrics: object) =>
        request('POST', `/sessions/${sessionId}/metrics`, metrics),

    logAlert: async (sessionId: string, alertType: string, severity: string, message: string) =>
        request('POST', `/sessions/${sessionId}/alerts`, { alertType, severity, message })
};