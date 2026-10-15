export default function HandoverArt() {
  return (
    <svg viewBox="0 0 520 400" role="img" aria-label="A young woman handing her resume to a recruiter" className="art">
      <defs>
        <linearGradient id="hw-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity=".18" />
          <stop offset="1" stopColor="var(--accent2)" stopOpacity=".18" />
        </linearGradient>
      </defs>
      <rect x="10" y="10" width="500" height="380" rx="28" fill="url(#hw-bg)" />
      <circle cx="420" cy="80" r="38" fill="var(--accent2)" opacity=".25" />
      <circle cx="90" cy="70" r="22" fill="var(--accent)" opacity=".25" />
      {/* floor */}
      <ellipse cx="260" cy="352" rx="210" ry="14" fill="var(--ink)" opacity=".10" />

      {/* ---------- Girl (left) ---------- */}
      {/* legs */}
      <rect x="132" y="262" width="22" height="84" rx="9" fill="#2d3050" />
      <rect x="166" y="262" width="22" height="84" rx="9" fill="#2d3050" />
      <rect x="126" y="340" width="34" height="12" rx="6" fill="#1b1d33" />
      <rect x="160" y="340" width="34" height="12" rx="6" fill="#1b1d33" />
      {/* blazer */}
      <path d="M112 160 Q160 140 208 160 L216 276 L104 276 Z" fill="#7c6cff" />
      <path d="M160 150 L144 190 L160 276 L176 190 Z" fill="#fff" opacity=".92" />
      {/* back arm */}
      <path d="M116 170 Q96 220 112 250" stroke="#7c6cff" strokeWidth="22" strokeLinecap="round" fill="none" />
      <circle cx="113" cy="254" r="10" fill="#f1c7a4" />
      {/* hair back */}
      <path d="M118 96 Q110 168 132 190 L190 190 Q214 160 202 96 Q160 56 118 96Z" fill="#3a2418" />
      {/* neck + face */}
      <rect x="150" y="136" width="20" height="26" rx="8" fill="#f1c7a4" />
      <ellipse cx="160" cy="110" rx="36" ry="40" fill="#f6d2b1" />
      {/* hair fringe */}
      <path d="M122 106 Q128 62 166 66 Q198 70 198 108 Q176 84 144 90 Q130 94 122 106Z" fill="#3a2418" />
      {/* face */}
      <circle cx="147" cy="112" r="3.2" fill="#2a1a12" />
      <circle cx="174" cy="112" r="3.2" fill="#2a1a12" />
      <path d="M150 128 Q160 138 172 128" stroke="#b5503f" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="140" cy="124" r="5" fill="#f19a8a" opacity=".45" />
      <circle cx="181" cy="124" r="5" fill="#f19a8a" opacity=".45" />
      {/* front arm extended with resume */}
      <path d="M196 176 Q236 200 270 192" stroke="#7c6cff" strokeWidth="22" strokeLinecap="round" fill="none" />
      <circle cx="274" cy="192" r="11" fill="#f6d2b1" />
      {/* resume */}
      <g transform="rotate(-8 292 176)">
        <rect x="262" y="132" width="76" height="98" rx="6" fill="#ffffff" stroke="#cfd3f5" strokeWidth="2" />
        <circle cx="280" cy="152" r="8" fill="#b9b1ff" />
        <rect x="294" y="146" width="34" height="5" rx="2.5" fill="#7c6cff" />
        <rect x="294" y="156" width="24" height="4" rx="2" fill="#c8cbe8" />
        <rect x="272" y="174" width="56" height="4" rx="2" fill="#c8cbe8" />
        <rect x="272" y="184" width="50" height="4" rx="2" fill="#c8cbe8" />
        <rect x="272" y="194" width="56" height="4" rx="2" fill="#c8cbe8" />
        <rect x="272" y="204" width="38" height="4" rx="2" fill="#c8cbe8" />
        <text x="272" y="222" fontSize="9" fontWeight="700" fill="#7c6cff">RESUME</text>
      </g>
      <circle cx="292" cy="196" r="9" fill="#f6d2b1" />

      {/* ---------- Recruiter (right) ---------- */}
      <rect x="338" y="262" width="22" height="84" rx="9" fill="#1f2a44" />
      <rect x="372" y="262" width="22" height="84" rx="9" fill="#1f2a44" />
      <rect x="332" y="340" width="34" height="12" rx="6" fill="#111827" />
      <rect x="366" y="340" width="34" height="12" rx="6" fill="#111827" />
      <path d="M310 160 Q366 140 420 160 L426 276 L304 276 Z" fill="#34c9a0" />
      <path d="M366 150 L350 190 L366 276 L382 190 Z" fill="#fff" opacity=".9" />
      <path d="M366 160 L360 196 L366 214 L372 196 Z" fill="#1f2a44" />
      <path d="M420 172 Q440 220 424 250" stroke="#34c9a0" strokeWidth="22" strokeLinecap="round" fill="none" />
      <circle cx="424" cy="254" r="10" fill="#d9a77d" />
      <rect x="356" y="136" width="20" height="26" rx="8" fill="#d9a77d" />
      <ellipse cx="366" cy="110" rx="34" ry="38" fill="#e3b48c" />
      <path d="M332 104 Q336 66 368 66 Q398 68 400 104 Q384 84 360 86 Q342 88 332 104Z" fill="#20160f" />
      <circle cx="354" cy="112" r="3.2" fill="#2a1a12" />
      <circle cx="378" cy="112" r="3.2" fill="#2a1a12" />
      <path d="M356 126 Q366 136 378 126" stroke="#8a3b2e" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* reaching arm */}
      <path d="M326 176 Q310 196 300 198" stroke="#34c9a0" strokeWidth="22" strokeLinecap="round" fill="none" />
      <circle cx="303" cy="198" r="10" fill="#e3b48c" />
      {/* clipboard */}
      <rect x="396" y="214" width="46" height="60" rx="5" fill="#fff" stroke="#cfd3f5" strokeWidth="2" />
      <rect x="410" y="208" width="18" height="9" rx="3" fill="#7c6cff" />
      <rect x="403" y="228" width="32" height="4" rx="2" fill="#c8cbe8" />
      <rect x="403" y="238" width="26" height="4" rx="2" fill="#c8cbe8" />
      <path d="M404 252 l6 6 l12 -12" stroke="#34c9a0" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* sparkles */}
      <path d="M250 96 l5 12 l12 5 l-12 5 l-5 12 l-5 -12 l-12 -5 l12 -5z" fill="var(--accent)" opacity=".7" />
      <path d="M470 200 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3z" fill="var(--accent2)" opacity=".8" />
    </svg>
  );
}
