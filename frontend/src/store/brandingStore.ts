import { create } from "zustand";
import { client } from "../api/client";

interface BrandingState {
  logoUrl: string | null;
  logoUrlDark: string | null;
  fetchLogo: () => Promise<void>;
}

export const useBrandingStore = create<BrandingState>((set) => ({
  logoUrl: null,
  logoUrlDark: null,
  fetchLogo: async () => {
    try {
      const res = await client.get("/settings/logo");
      set({
        logoUrl: res.data.logoUrl || null,
        logoUrlDark: res.data.logoUrlDark || null,
      });
    } catch {
      set({ logoUrl: null, logoUrlDark: null });
    }
  },
}));
