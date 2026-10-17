export function HackClubFlag({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <span className="inline-flex shrink-0" title="Hack Club member">
      <img src="https://assets.hackclub.com/icon-rounded.svg" alt="Hack Club member" width="20" height="20" className={className} />
    </span>
  );
}
