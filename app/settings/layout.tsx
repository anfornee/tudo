import { AuthenticatedAppLayout } from "@/components/authenticated-app-layout";

export default function SettingsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AuthenticatedAppLayout>{children}</AuthenticatedAppLayout>;
}
