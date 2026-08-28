import { AuthenticatedAppLayout } from "@/components/authenticated-app-layout";

export default function WeatherLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AuthenticatedAppLayout>{children}</AuthenticatedAppLayout>;
}
