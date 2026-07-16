import { create } from 'zustand';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: 'receptionist' | 'doctor' | 'manager';
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  fetchCurrentUser: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => void;
  loadFromStorage: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  isLoading: true,
  error: null,

  login: async (username, password) => {
    set({ error: null });
    try {
      const res = await fetch('/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.message || 'Đăng nhập thất bại';
        set({ error: msg });
        return false;
      }

      const user: User = {
        id: json.data.user.id,
        username: json.data.user.username,
        fullName: json.data.user.full_name || json.data.user.username,
        role: (json.data.user.role || 'doctor').toLowerCase(),
      };

      localStorage.setItem('authToken', json.data.token);
      if (json.data.refreshToken) {
        localStorage.setItem('refreshToken', json.data.refreshToken);
      }
      localStorage.setItem('authUser', JSON.stringify(user));
      set({
        token: json.data.token,
        refreshToken: json.data.refreshToken || null,
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
      const res = await fetch('/api/auth/users/', {
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

  refreshAccessToken: async () => {
    const { refreshToken } = get();
    if (!refreshToken) return false;

    try {
      const res = await fetch('/api/auth/refresh/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('authUser');
        set({ token: null, refreshToken: null, user: null });
        return false;
      }

      localStorage.setItem('authToken', json.data.token);
      if (json.data.refreshToken) {
        localStorage.setItem('refreshToken', json.data.refreshToken);
      }

      set({
        token: json.data.token,
        refreshToken: json.data.refreshToken || refreshToken,
      });
      return true;
    } catch {
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('authUser');
    set({ token: null, refreshToken: null, user: null });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('authToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const storedUser = localStorage.getItem('authUser');
    if (token) {
      const user = storedUser ? JSON.parse(storedUser) : null;
      if (user?.role) user.role = user.role.toLowerCase();
      set({ token, refreshToken, user, isLoading: false });
    } else {
      set({ refreshToken, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
