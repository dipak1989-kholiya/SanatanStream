"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center p-4 text-center">
      <h2 className="text-2xl font-bold text-white mb-2">404 - Page Not Found</h2>
      <p className="text-slate-400 mb-6">The sacred stream or page you are looking for does not exist.</p>
      <Link href="/" className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold rounded-xl transition duration-200">
        Return Home
      </Link>
    </div>
  );
}
