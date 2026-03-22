import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVER_URL } from './config';

const BACKEND_URL = SERVER_URL;

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

    const text = await res.text();
    console.log('response status:', res.status);
    console.log('response body:', text);

    let data: any = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      if (!res.ok) {
        throw new Error(
          `Server returned ${res.status} ${res.statusText}. ` +
            `Expected JSON but got a non-JSON response.`,
        );
      }

      throw new Error('Server returned an invalid JSON response.');
    }

    if (!res.ok) throw new Error(data?.error ?? 'Request failed');
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
