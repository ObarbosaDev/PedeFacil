import { useEffect, useState } from "react";

export default function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[120] border-b border-destructive/20 bg-destructive text-destructive-foreground">
      <div className="mx-auto flex min-h-10 max-w-6xl items-center justify-center px-4 py-2 text-center text-sm font-medium">
        Você ficou sem conexão. Assim que a internet voltar, atualize a página para sincronizar tudo.
      </div>
    </div>
  );
}
