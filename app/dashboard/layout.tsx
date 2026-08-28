import { AuthenticatedAppLayout } from "@/components/authenticated-app-layout";

export default function DashboardLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return <AuthenticatedAppLayout>{children}</AuthenticatedAppLayout>;
}
