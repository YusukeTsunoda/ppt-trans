export default function TestPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          CSS Test Page
        </h1>
        
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 mb-4">
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
            Card Component
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            This is a test card to verify Tailwind CSS is working.
          </p>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-blue-500 text-white p-4 rounded">Blue Box</div>
          <div className="bg-green-500 text-white p-4 rounded">Green Box</div>
          <div className="bg-red-500 text-white p-4 rounded">Red Box</div>
        </div>
        
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
          Test Button
        </button>
      </div>
    </div>
  );
}