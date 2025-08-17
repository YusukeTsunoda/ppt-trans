export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          PowerPoint Translator
        </h1>
        <p className="text-gray-600">
          環境構築成功！ 🎉
        </p>
        <div className="mt-8 space-y-2 text-left bg-gray-100 p-4 rounded">
          <p>✅ Next.js: 動作中</p>
          <p>✅ TypeScript: 設定済み</p>
          <p>✅ Tailwind CSS: 有効</p>
        </div>
      </div>
    </div>
  );
}