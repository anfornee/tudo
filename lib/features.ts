import { Bike, CloudSun, Grid3X3, ReceiptText, type LucideIcon } from "lucide-react";

export interface AppFeature {
  id: "weather" | "sudoku" | "rides" | "bills";
  label: string;
  href: string;
  icon: LucideIcon;
  showInNav: boolean;
  showOnDashboard: boolean;
}

export const appFeatures = [
  {
    id: "weather",
    label: "Weather",
    href: "/weather",
    icon: CloudSun,
    showInNav: true,
    showOnDashboard: true,
  },
  {
    id: "sudoku",
    label: "Sudoku",
    href: "/sudoku",
    icon: Grid3X3,
    showInNav: true,
    showOnDashboard: true,
  },
  {
    id: "rides",
    label: "Rides",
    href: "/rides",
    icon: Bike,
    showInNav: true,
    showOnDashboard: true,
  },
  {
    id: "bills",
    label: "Bills",
    href: "/bills",
    icon: ReceiptText,
    showInNav: true,
    showOnDashboard: true,
  },
] as const satisfies readonly AppFeature[];
