import { AuthenticatedAppLayout } from "@/components/authenticated-app-layout";

export default function RidesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AuthenticatedAppLayout>{children}</AuthenticatedAppLayout>;
}
