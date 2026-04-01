export default function Home() {
  return (
    <main className="min-h-screen bg-[#100a04] flex flex-col items-center justify-center px-6">
      <h1 className="text-6xl font-black text-[#fff1e6] tracking-tighter mb-2">
        scout
      </h1>
      <p className="text-[#7a5535] text-lg mb-12">
        finds what&apos;s worth your time
      </p>
      <div className="flex gap-4">
        <a
          href="#"
          className="bg-[#e8a020] text-[#100a04] font-bold px-8 py-4 rounded-full text-sm"
        >
          Download on iOS
        </a>
        <a
          href="#"
          className="border border-[#2e1a0a] text-[#7a5535] px-8 py-4 rounded-full text-sm"
        >
          Get it on Android
        </a>
      </div>
    </main>
  )
}
