"use client"

export function GlobalStyles() {
  return (
    <style jsx global>{`
      /* Tactical focus styles */
      *:focus-visible {
        outline: 1px solid var(--tac-text-primary, #fff);
        outline-offset: 1px;
      }
      
      /* Corner decoration utility */
      .tactical-corners {
        position: relative;
      }
      
      .tactical-corners::before,
      .tactical-corners::after {
        content: '';
        position: absolute;
        width: 6px;
        height: 6px;
        border-color: var(--tac-text-muted, #404040);
        pointer-events: none;
      }
      
      .tactical-corners::before {
        top: 0;
        left: 0;
        border-top: 1px solid;
        border-left: 1px solid;
      }
      
      .tactical-corners::after {
        bottom: 0;
        right: 0;
        border-bottom: 1px solid;
        border-right: 1px solid;
      }
      
      /* Glitch effect for critical states */
      @keyframes tac-glitch {
        0%, 100% { transform: translate(0); }
        20% { transform: translate(-1px, 1px); }
        40% { transform: translate(1px, -1px); }
        60% { transform: translate(-1px, -1px); }
        80% { transform: translate(1px, 1px); }
      }
      
      .tac-glitch {
        animation: tac-glitch 0.3s infinite;
      }
      
      /* Scanline effect */
      .tac-scanlines::after {
        content: '';
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0, 0, 0, 0.1) 2px,
          rgba(0, 0, 0, 0.1) 4px
        );
        pointer-events: none;
      }
    `}</style>
  )
}
