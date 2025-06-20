"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "~/app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/app/components/ui/card";
import { Separator } from "~/app/components/ui/separator";
import { 
  User, 
  CreditCard, 
  LogOut, 
  Moon, 
  Sun, 
  ChevronRight,
  Mail,
  Shield,
  Bell
} from "lucide-react";
import { useTheme } from "next-themes";
import { ClientOnly } from "~/app/components/ClientOnly";
import Link from "next/link";

export default function Settings() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  
  const subscription = useQuery(api.subscriptions.fetchUserSubscription);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const settingsGroups = [
    {
      title: "Account",
      items: [
        {
          icon: User,
          label: "Profile",
          description: "Manage your personal information",
          href: "/profile",
        },
        {
          icon: Mail,
          label: "Email",
          description: user?.emailAddresses[0]?.emailAddress || "Not set",
          disabled: true,
        },
      ],
    },
    {
      title: "Subscription",
      items: [
        {
          icon: CreditCard,
          label: "Billing",
          description: subscription ? `${subscription.status} - ${subscription.productName}` : "No active subscription",
          href: "/pricing",
        },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          icon: theme === "dark" ? Moon : Sun,
          label: "Theme",
          description: `Currently using ${theme} mode`,
          action: () => setTheme(theme === "dark" ? "light" : "dark"),
        },
        {
          icon: Bell,
          label: "Notifications",
          description: "Configure notification preferences",
          disabled: true,
        },
      ],
    },
    {
      title: "Privacy & Security",
      items: [
        {
          icon: Shield,
          label: "Privacy Policy",
          description: "Read our privacy policy",
          href: "/privacy",
          external: true,
        },
      ],
    },
  ];

  return (
    <ClientOnly>
      <div className="container mx-auto p-4 max-w-2xl pb-20">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        
        <div className="space-y-6">
          {settingsGroups.map((group) => (
            <Card key={group.title}>
              <CardHeader>
                <CardTitle className="text-lg">{group.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {group.items.map((item, index) => {
                  const Icon = item.icon;
                  const isLast = index === group.items.length - 1;
                  
                  const content = (
                    <>
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium">{item.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                        {!item.disabled && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      {!isLast && <Separator className="mt-4" />}
                    </>
                  );
                  
                  if (item.disabled) {
                    return (
                      <div key={item.label} className="px-6 py-4 opacity-50">
                        {content}
                      </div>
                    );
                  }
                  
                  if (item.action) {
                    return (
                      <button
                        key={item.label}
                        onClick={item.action}
                        className="w-full px-6 py-4 text-left hover:bg-muted/50 transition-colors"
                      >
                        {content}
                      </button>
                    );
                  }
                  
                  if (item.href) {
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        target={item.external ? "_blank" : undefined}
                        rel={item.external ? "noopener noreferrer" : undefined}
                        className="block px-6 py-4 hover:bg-muted/50 transition-colors"
                      >
                        {content}
                      </Link>
                    );
                  }
                  
                  return null;
                })}
              </CardContent>
            </Card>
          ))}
          
          <Card>
            <CardContent className="p-6">
              <Button
                variant="destructive"
                onClick={handleSignOut}
                className="w-full"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </ClientOnly>
  );
}