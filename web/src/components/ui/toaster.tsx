import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";

interface Toast {
  id: number;
  msg: string;
}

let nextId = 1;

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const id = nextId++;
      const msg = (e as CustomEvent<string>).detail;
      setItems((cur) => [...cur, { id, msg }]);
      setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 5000);
    };
    window.addEventListener("hr:toast", onToast);
    return () => window.removeEventListener("hr:toast", onToast);
  }, []);

  if (items.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[200] grid gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "max-w-sm rounded-md border border-border bg-navy px-4 py-3 text-sm text-white shadow-lg"
          )}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

export function toast(msg: string) {
  window.dispatchEvent(new CustomEvent("hr:toast", { detail: msg }));
}
