const ART = ` █████╗ ██████╗  ██████╗██╗  ██╗ ██████╗ ███╗   ██╗
██╔══██╗██╔══██╗██╔════╝██║  ██║██╔═══██╗████╗  ██║
███████║██████╔╝██║     ███████║██║   ██║██╔██╗ ██║
██╔══██║██╔══██╗██║     ██╔══██║██║   ██║██║╚██╗██║
██║  ██║██║  ██║╚██████╗██║  ██║╚██████╔╝██║ ╚████║
╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═══╝`;

export function AsciiLogo() {
  return (
    <pre
      aria-label="Archon"
      className="font-mono text-[var(--color-accent)] leading-[1.05] select-none whitespace-pre text-[clamp(0.42rem,1.7vw,0.95rem)] mx-auto"
    >
      {ART}
    </pre>
  );
}
