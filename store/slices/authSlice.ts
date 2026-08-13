import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Profile } from "@/types/database";

interface AuthState {
  profile: Profile | null;
  initialized: boolean;
}

const initialState: AuthState = {
  profile: null,
  initialized: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setProfile(state, action: PayloadAction<Profile | null>) {
      state.profile = action.payload;
      state.initialized = true;
    },
    setInitialized(state, action: PayloadAction<boolean>) {
      state.initialized = action.payload;
    },
    clearAuth(state) {
      state.profile = null;
      state.initialized = true;
    },
  },
});

export const { setProfile, setInitialized, clearAuth } = authSlice.actions;
export default authSlice.reducer;
