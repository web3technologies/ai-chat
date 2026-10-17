import { Suspense } from "react";
import ChatPage from "@/ui/components/ChatPage";

export default function Page() {
  return (
    <Suspense fallback={<p className="px-6 py-16 text-sm text-zinc-500">Loading...</p>}>
      <ChatPage />
    </Suspense>
  );
}
