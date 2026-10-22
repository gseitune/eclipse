/**
 * Iconos de la casa. Trazo de 2, viewBox 24 y `currentColor`, así heredan el
 * color del botón y no arrastran relleno propio.
 */
type IconoProps = { className?: string };

export function IconoApagado({ className = "" }: IconoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3.5v8.5"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18.36 6.64a9 9 0 1 1-12.73 0"
      />
    </svg>
  );
}

export function IconoCasa({ className = "" }: IconoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10.5 12 3l9 7.5V21a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 21v-10.5Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.75 22.5v-6.75h4.5v6.75"
      />
    </svg>
  );
}

export function IconoEngranaje({ className = "" }: IconoProps) {  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

export function IconoMas({ className = "" }: IconoProps) {
  return (
    <svg
      className={className}
      viewBox="4 4 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5.5v13" />
      <path d="M5.5 12h13" />
    </svg>
  );
}

export function IconoCandado({ className = "" }: IconoProps) {
  return (
    <svg
      className={className}
      viewBox="3 2 18 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4.5" y="10" width="15" height="11" rx="2" />
      <path d="M8.5 10V7a3.5 3.5 0 0 1 7 0v3" />
    </svg>
  );
}
