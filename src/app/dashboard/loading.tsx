export default function DashboardLoading() {
  return (
    <div className="flex h-screen bg-secondary-50 items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-secondary-600">ダッシュボードを読み込み中...</p>
      </div>
    </div>
  );
}