"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, FileText, User } from "lucide-react";
import { cn } from "~/lib/utils";
interface AppNavProps {
  user: { firstName: string | null } | null;
}

export function AppNav({ user }: AppNavProps) {
  const pathname = usePathname();

  const navigation = [
    { name: "Chat", href: "/chat", icon: MessageCircle },
    { name: "Diary", href: "/diary", icon: FileText },
    {
      name: user?.firstName || "Profile",
      href: "/profile",
      icon: User,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
      <ul className="flex justify-around items-center h-16">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.name}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-4 py-2 text-xs transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}