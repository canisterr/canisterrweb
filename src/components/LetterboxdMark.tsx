export default function LetterboxdMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 72 28" className={className}>
      <circle cx="14" cy="14" r="13.5" fill="#ff8000" />
      <circle cx="36" cy="14" r="13.5" fill="#00c030" />
      <circle cx="58" cy="14" r="13.5" fill="#40bcf4" />
      <path d="M24.4 3.1c3.5 3.2 4.1 18.5 0 21.8 2.1-5.2 2.1-16.6 0-21.8Z" fill="#f8f8f6" />
      <path d="M46.4 3.1c3.5 3.2 4.1 18.5 0 21.8 2.1-5.2 2.1-16.6 0-21.8Z" fill="#f8f8f6" />
    </svg>
  );
}
