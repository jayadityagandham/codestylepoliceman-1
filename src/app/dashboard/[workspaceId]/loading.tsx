import { Loader2, Shield } from 'lucide-react'

export default function WorkspaceLoading() {
  return (
    <div className="min-h-screen bg-[#f4f5f8] text-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Shield className="size-4" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Opening workspace</p>
            <p className="text-xs text-slate-500">Loading commits, pull requests, and team activity.</p>
          </div>
        </div>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
          <Loader2 className="size-4 animate-spin text-slate-700" />
          <span className="text-xs font-semibold text-slate-600">Please wait...</span>
        </div>
      </div>
    </div>
  )
}
