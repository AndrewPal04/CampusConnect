import { create } from 'zustand';

/**
 * Auth store — wraps Firebase auth state.
 * Usage: const { user, loading } = useAuthStore();
 */
export const useAuthStore = create((set) => ({
  user: null,
  loading: true,
  userType: null, // 'student' | 'organiser'

  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  setUserType: (userType) => set({ userType }),

  logout: async () => {
    // Import here to avoid circular deps at module load time
    const { auth } = await import('@utils/firebase');
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
    set({ user: null, userType: null });
  },

  init: () => {
    // Attach Firebase auth listener — returns unsubscribe fn
    import('@utils/firebase').then(({ auth }) => {
      import('firebase/auth').then(({ onAuthStateChanged }) => {
        onAuthStateChanged(auth, (firebaseUser) => {
          set({ user: firebaseUser, loading: false });
        });
      });
    });
  },
}));

