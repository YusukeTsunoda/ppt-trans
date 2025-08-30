import ErrorBoundaryWrapper from '@/components/ErrorBoundaryWrapper';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundaryWrapper>
      {children}
    </ErrorBoundaryWrapper>
  );
}