type Props = {
  size?: number;
  className?: string;
};

/** Marca Luxton: o "X" verde (braço superior-esquerdo aberto) com o avião de
    papel nesse canto. Fundo transparente. */
export function LuxtonMark({ size = 44, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* X: diagonal completa (braços sup-dir e inf-esq) + braço inf-dir */}
      <path
        d="M104 24 L24 104 M64 64 L104 104"
        stroke="#16A34A"
        strokeWidth="15"
        strokeLinecap="square"
      />
      {/* Avião de papel (contorno) no canto superior-esquerdo */}
      <path
        d="M16 18 L50 30 L32 34 L30 50 Z M16 18 L32 34"
        stroke="#8B9096"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Wordmark "Luxton" com traço fino e o "x" em destaque, como no material da marca. */
export function LuxtonWordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-title font-light tracking-[0.4em] ${className}`}
      style={{ fontWeight: 300 }}
    >
      Lu<span className="text-green-accent">x</span>ton
    </span>
  );
}
