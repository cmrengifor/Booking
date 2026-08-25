"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, FileText, LayoutDashboard, LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Avatar({ name, avatarUrl, size }: { name: string; avatarUrl: string | null; size: number }) {
  if (avatarUrl) {
    return (
      <div className="relative shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}>
        <Image src={avatarUrl} alt={name} fill sizes={`${size}px`} className="object-cover" />
      </div>
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 font-heading text-gold"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </div>
  );
}

/**
 * Adapted from kokonutui's Profile Dropdown (kokonutui.com/docs/navigation/profile-dropdown)
 * — the AI-chat sample data (subscription tier, model badge) and blue/
 * purple accents are gone; menu items route to this salon's real pages
 * and colors follow the site's gold/neutral tokens instead.
 */
export function ProfileDropdown({
  slug,
  name,
  email,
  avatarUrl,
  unreadCount = 0,
  isStaff = false,
  onSignOut,
  className,
}: {
  slug: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  unreadCount?: number;
  isStaff?: boolean;
  onSignOut: () => void | Promise<void>;
  className?: string;
}) {
  const menuItems = [
    { label: "Mi cuenta", href: `/salon/${slug}/account`, icon: <User className="size-4" /> },
    {
      label: "Notificaciones",
      href: `/salon/${slug}/notifications`,
      icon: <Bell className="size-4" />,
      value: unreadCount > 0 ? String(unreadCount) : undefined,
    },
    ...(isStaff
      ? [
          {
            label: "Panel del salón",
            href: `/salon/${slug}/admin`,
            icon: <LayoutDashboard className="size-4" />,
          },
        ]
      : []),
    { label: "Privacidad", href: `/salon/${slug}/privacidad`, icon: <FileText className="size-4" /> },
  ];

  return (
    <div className={cn("relative", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Cuenta"
              className="flex items-center rounded-full border border-transparent p-0.5 transition-colors hover:border-border focus:outline-none"
            />
          }
        >
          <Avatar name={name} avatarUrl={avatarUrl} size={32} />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={10}
          className="w-64 rounded-xl border border-border bg-background p-2 shadow-lg"
        >
          <div className="flex items-center gap-3 p-2">
            <Avatar name={name} avatarUrl={avatarUrl} size={40} />
            <div className="min-w-0">
              <p className="truncate font-sans text-sm text-foreground">{name}</p>
              <p className="truncate font-sans text-xs text-muted-foreground">{email}</p>
            </div>
          </div>

          <DropdownMenuSeparator />

          <div className="flex flex-col gap-0.5">
            {menuItems.map((item) => (
              <DropdownMenuItem key={item.label} render={<Link href={item.href} />} className="justify-between">
                <span className="flex items-center gap-2">
                  {item.icon}
                  {item.label}
                </span>
                {item.value && (
                  <span className="rounded-full bg-gold/10 px-2 py-0.5 font-mono text-xs text-gold">
                    {item.value}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            nativeButton
            render={<button type="button" onClick={() => onSignOut()} />}
          >
            <LogOut className="size-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
