import { Icons } from "~/app/components/landing/icons";
import { buttonVariants } from "~/app/components/landing/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTrigger,
  DrawerTitle,
} from "~/app/components/landing/ui/drawer";
import { siteConfig } from "~/app/lib/landing/config";
import { cn } from "~/app/lib/landing/utils";
import Link from "next/link";
import { Menu } from "lucide-react";

export function MobileDrawer() {
  return (
    <Drawer>
      <DrawerTrigger>
        <Menu className="h-6 w-6" />
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="px-6">
          <DrawerTitle className="sr-only">Navigation Menu</DrawerTitle>
          <div className="">
            <Link
              href="/"
              title="brand-logo"
              className="relative mr-6 flex items-center space-x-2"
            >
              <Icons.logo className="h-8 w-auto" />
              <span
                className="text-xl"
                style={{
                  fontFamily: '"Fugaz One", Inter, sans-serif',
                  fontWeight: 400,
                }}
              >
                BOB
              </span>
            </Link>
          </div>
        </DrawerHeader>
        <DrawerFooter>
          <Link
            href="/sign-up"
            className={cn(
              buttonVariants({ variant: "default" }),
              "text-black rounded-full group",
            )}
          >
            {siteConfig.cta}
          </Link>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
