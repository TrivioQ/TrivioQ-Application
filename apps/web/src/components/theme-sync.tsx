'use client';

import { useEffect, useRef } from 'react';
import { useUserProfile } from '../hooks/use-user-profile';
import { useTheme } from '../context/ThemeContext';
import Cookies from 'js-cookie';

export function ThemeSync() {
  const { data: profile } = useUserProfile();
  const { theme, setTheme } = useTheme();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (profile?.preferences?.theme && !syncedRef.current) {
      const dbTheme = profile.preferences.theme;
      const currentCookie = Cookies.get('theme');

      // If the backend has a theme and it differs from the local cookie/state on first load, sync it
      if (dbTheme !== currentCookie || dbTheme !== theme) {
        setTheme(dbTheme);
      }

      // Mark as synced for this session so we don't keep overriding user's manual changes
      syncedRef.current = true;
    }
  }, [profile, theme, setTheme]);

  return null;
}
