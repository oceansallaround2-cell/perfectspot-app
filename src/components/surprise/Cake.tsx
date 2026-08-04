/** Hand-drawn cake with a candle whose flame can be blown out. */
export function Cake({ lit }: { lit: boolean }) {
  return (
    <div className="relative flex flex-col items-center">
      <div className="relative h-24 w-6">
        {/* flame */}
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2 transition-all duration-700"
          style={{
            opacity: lit ? 1 : 0,
            transform: `translateX(-50%) scale(${lit ? 1 : 0.2}) translateY(${lit ? 0 : -18}px)`,
          }}
        >
          <div
            className="h-8 w-5 rounded-full"
            style={{
              background: "radial-gradient(circle at 50% 70%, #FFF3C4 0%, #FFC94D 45%, #FF7A18 80%, transparent 100%)",
              filter: "blur(0.4px)",
              boxShadow: "0 0 34px 12px rgba(255,170,60,0.45)",
              animation: "ps-flicker 1.1s ease-in-out infinite",
            }}
          />
        </div>
        {!lit && (
          <div
            className="absolute left-1/2 top-2 -translate-x-1/2 text-lg opacity-70"
            style={{ animation: "ps-smoke 2.4s ease-out infinite" }}
          >
            💨
          </div>
        )}
        {/* candle */}
        <div className="absolute bottom-0 left-1/2 h-14 w-3 -translate-x-1/2 rounded-sm bg-gradient-to-b from-[#F6E8FF] to-[#C4A7F5]" />
      </div>

      {/* cake body */}
      <div className="relative -mt-1 w-56">
        <div className="mx-auto h-6 w-52 rounded-t-3xl bg-gradient-to-b from-[#F4E4FF] to-[#D9BCF7] shadow-inner" />
        <div className="mx-auto h-16 w-56 rounded-b-2xl rounded-t-md bg-gradient-to-b from-[#8A5FC9] to-[#4B2E83]" />
        <div className="mx-auto h-4 w-60 rounded-full bg-gradient-to-b from-[#2E1F4D] to-[#171321]" />
        <div
          className="pointer-events-none absolute inset-x-0 -bottom-6 mx-auto h-10 w-64 rounded-full blur-2xl"
          style={{ background: "radial-gradient(circle, rgba(138,95,201,0.5), transparent 70%)" }}
        />
      </div>
    </div>
  );
}
