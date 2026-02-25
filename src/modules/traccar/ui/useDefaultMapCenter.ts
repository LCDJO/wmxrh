import { useState, useEffect } from 'react';

const DEFAULT_CENTER = { lat: -23.5505, lng: -46.6333 };
let cachedPosition: { lat: number; lng: number } | null = null;

export function useDefaultMapCenter() {
  const [center, setCenter] = useState(cachedPosition || DEFAULT_CENTER);

  useEffect(() => {
    if (cachedPosition) return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        cachedPosition = loc;
        setCenter(loc);
      },
      () => { /* keep default */ },
      { timeout: 5000, maximumAge: 300000 }
    );
  }, []);

  return center;
}
