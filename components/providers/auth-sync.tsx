"use client";

import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { createClient } from "@/lib/supabase/client";
import { setProfile, clearAuth } from "@/store/slices/authSlice";
import { useGetMyProfileQuery } from "@/store/api/fourtyApi";
import type { AppDispatch } from "@/store";

export function AuthSync({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const { data: profile, refetch } = useGetMyProfileQuery();

  useEffect(() => {
    dispatch(setProfile(profile ?? null));
  }, [profile, dispatch]);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_OUT") {
        dispatch(clearAuth());
      } else {
        await refetch();
      }
    });
    return () => subscription.unsubscribe();
  }, [dispatch, refetch]);

  return <>{children}</>;
}
