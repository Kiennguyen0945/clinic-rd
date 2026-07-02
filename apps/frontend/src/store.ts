import { create } from 'zustand';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: 'receptionist' | 'doctor' | 'manager';
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  fetchCurrentUser: () => Promise<void>;
  logout: () => void;
  loadFromStorage: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  error: null,

  login: async (username, password) => {
    set({ error: null });
    try {
      const res = await fetch('/api/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        set({ error: data.errors || 'Đăng nhập thất bại' });
        return false;
      }

      const user: User = {
        id: data.user.id,
        username: data.user.username,
        fullName: data.user.full_name || data.user.username,
        role: data.user.role || 'doctor',
      };

      localStorage.setItem('authToken', data.token);
      localStorage.setItem('authUser', JSON.stringify(user));
      set({
        token: data.token,
        user,
        isLoading: false,
        error: null,
      });
      return true;
    } catch {
      set({ error: 'Không thể kết nối máy chủ' });
      return false;
    }
  },

  fetchCurrentUser: async () => {
    const { token } = get();
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const res = await fetch('/api/users/', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        // Lấy user từ localStorage (login đã lưu sẵn)
        const stored = localStorage.getItem('authUser');
        if (stored) {
          set({ user: JSON.parse(stored), isLoading: false });
        } else {
          set({ isLoading: false });
        }
      } else {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        set({ token: null, user: null, isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    set({ token: null, user: null });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');
    if (token) {
      set({ token, user: storedUser ? JSON.parse(storedUser) : null, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
