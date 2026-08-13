import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { DateRangeFilter } from "@/types/database";

interface UiState {
  sidebarOpen: boolean;
  storeFilter: string | "all";
  dateFilter: DateRangeFilter;
}

const initialState: UiState = {
  sidebarOpen: false,
  storeFilter: "all",
  dateFilter: { preset: "month" },
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setStoreFilter(state, action: PayloadAction<string | "all">) {
      state.storeFilter = action.payload;
    },
    setDateFilter(state, action: PayloadAction<DateRangeFilter>) {
      state.dateFilter = action.payload;
    },
  },
});

export const { setSidebarOpen, toggleSidebar, setStoreFilter, setDateFilter } =
  uiSlice.actions;
export default uiSlice.reducer;
