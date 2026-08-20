"use client";

import { useEffect } from "react";

const KEY = "home-scroll-y";

export function ScrollRestore() {
  useEffect(() => {
    // Restore saved position
    const saved = sessionStorage.getItem(KEY);
    if (saved) {
      const y = parseInt(saved, 10);
      if (!isNaN(y) && y > 0) {
        requestAnimationFrame(() => window.scrollTo(0, y));
      }
      sessionStorage.removeItem(KEY);
    }

    // Save position on scroll (debounced)
    let timer: ReturnType<typeof setTimeout>;
    function onScroll() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        sessionStorage.setItem(KEY, String(window.scrollY));
      }, 100);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
