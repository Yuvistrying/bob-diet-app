"use client"

import * as React from "react"
import { type Icon } from "@tabler/icons-react"
import { Link, useLocation } from "react-router"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar"

/**
 * Renders a sidebar navigation group with menu items, highlighting the active item based on the current route.
 *
 * Each menu item displays an icon and title. Items with a URL of "#" are shown as disabled and are not clickable.
 *
 * @param items - The navigation items to display, each with a title, URL, and icon.
 */
export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: Icon
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const location = useLocation();

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = location.pathname === item.url ||
                           (item.url.startsWith("/dashboard") && location.pathname.startsWith(item.url));
            const isImplemented = item.url !== "#";
            
            return (
              <SidebarMenuItem key={item.title}>
                {isImplemented ? (
                  <SidebarMenuButton isActive={isActive} asChild>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton disabled>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
