import { LayoutDashboard, FilePlus, UserCircle, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import heliconLogo from "@/assets/helicon-logo.png";
import heliconLogoText from "@/assets/helicon-logo-text.svg";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Nouveau dossier", url: "/dossier/nouveau", icon: FilePlus },
  { title: "Profil", url: "/profil", icon: UserCircle },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="h-auto py-8">
            <div className="flex items-center justify-center w-full">
              {collapsed
                ? <img src={heliconLogo} alt="Helicon.IA" className="h-10 w-10 object-contain" />
                : <img src={heliconLogoText} alt="Helicon.IA" className="h-28 object-contain" />
              }
            </div>
          </SidebarGroupLabel>
          {!collapsed && profile && (
            <div className="px-3 pb-3 pt-1">
              {profile.district && (
                <div className="text-[11px] text-sidebar-accent-foreground/60 leading-snug">{profile.district}</div>
              )}
              {profile.ligue && (
                <div className="text-[11px] text-sidebar-accent-foreground/60 leading-snug">{profile.ligue}</div>
              )}
            </div>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/60 rounded-lg transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground/60 hover:text-destructive hover:bg-sidebar-accent/40 text-xs"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && "Déconnexion"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
