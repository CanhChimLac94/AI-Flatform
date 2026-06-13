import { useEffect, useState } from "react";

/** True only after the component has mounted on the client (safe for locale/storage-dependent UI). */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
