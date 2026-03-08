import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border bg-card px-4 gap-4">
            <SidebarTrigger />
            <div className="ml-auto text-right leading-tight">
              <div className="text-sm font-medium text-foreground">
                {profile?.prenom} {profile?.nom}
              </div>
              {(profile?.district || profile?.ligue) && (
                <div className="text-[11px] text-muted-foreground truncate max-w-[240px]">
                  {[profile?.district, profile?.ligue].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
