// Design.md準拠のスケルトンローダーコンポーネント

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
      <div className="space-y-3">
        <div className="h-3 bg-slate-200 rounded"></div>
        <div className="h-3 bg-slate-200 rounded w-5/6"></div>
        <div className="h-3 bg-slate-200 rounded w-4/6"></div>
      </div>
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="animate-pulse">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* ヘッダー */}
        <div className="bg-slate-50 border-b border-slate-200 p-4">
          <div className="flex items-center space-x-4">
            <div className="h-4 bg-slate-200 rounded w-24"></div>
            <div className="h-4 bg-slate-200 rounded w-20"></div>
            <div className="h-4 bg-slate-200 rounded w-28"></div>
            <div className="h-4 bg-slate-200 rounded w-24"></div>
          </div>
        </div>
        
        {/* 行 */}
        {[...Array(5)].map((_, i) => (
          <div key={i} className="border-b border-slate-100 p-4 hover:bg-slate-50 transition-all duration-200">
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 bg-slate-200 rounded-lg"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
              </div>
              <div className="flex space-x-2">
                <div className="h-8 w-20 bg-slate-200 rounded-lg"></div>
                <div className="h-8 w-20 bg-slate-200 rounded-lg"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonButton() {
  return (
    <div className="animate-pulse">
      <div className="h-10 bg-slate-200 rounded-lg w-32"></div>
    </div>
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {[...Array(lines)].map((_, i) => (
        <div 
          key={i} 
          className="h-3 bg-slate-200 rounded"
          style={{ width: `${100 - (i * 15)}%` }}
        ></div>
      ))}
    </div>
  );
}

// Design.md準拠のフォームスケルトン
export function SkeletonForm() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-pulse">
      <div className="space-y-4">
        {/* ラベル */}
        <div>
          <div className="h-4 bg-slate-200 rounded w-20 mb-2"></div>
          <div className="h-10 bg-slate-100 rounded-lg border border-slate-200"></div>
        </div>
        
        {/* ラベル */}
        <div>
          <div className="h-4 bg-slate-200 rounded w-24 mb-2"></div>
          <div className="h-10 bg-slate-100 rounded-lg border border-slate-200"></div>
        </div>
        
        {/* ボタン */}
        <div className="flex space-x-2">
          <div className="h-10 bg-blue-200 rounded-lg w-24"></div>
          <div className="h-10 bg-slate-200 rounded-lg w-24"></div>
        </div>
      </div>
    </div>
  );
}

// プログレスバーのスケルトン
export function SkeletonProgress() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-32 mb-4"></div>
      
      {/* プログレスバー */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <div className="h-3 bg-slate-200 rounded w-16"></div>
          <div className="h-3 bg-slate-200 rounded w-10"></div>
        </div>
        <div className="h-3 bg-slate-200 rounded-full"></div>
      </div>
      
      {/* ステップ */}
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-start space-x-4">
            <div className="w-6 h-6 bg-slate-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-slate-200 rounded w-32 mb-2"></div>
              <div className="h-3 bg-slate-200 rounded w-48"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}