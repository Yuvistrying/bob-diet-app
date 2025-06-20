"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { MessageCircle, FileText, User } from "lucide-react";
import { cn } from "~/lib/utils";

const navigation = [
  { name: "Chat", href: "/chat", icon: MessageCircle },
  { name: "Diary", href: "/diary", icon: FileText },
  { name: "Profile", href: "/profile", icon: User },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative h-screen flex flex-col">
      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-16">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/40">
        <div className="grid grid-cols-3 h-16">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}