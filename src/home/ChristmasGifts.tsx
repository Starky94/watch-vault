import { useId } from 'react'

// Inline artwork stays visible without a separate image request.
export function ChristmasGifts({ className = '' }: { className?: string }) {
  const id = useId()
  return (
<svg className={`christmas-gifts ${className}`} aria-hidden="true" focusable="false" viewBox="0 0 240 170" fill="none">
<defs>
<linearGradient id={`${id}-red`} x2="1" y2="1"><stop stopColor="#ef6570"/><stop offset=".5" stopColor="#b91c3c"/><stop offset="1" stopColor="#670d29"/></linearGradient>
<linearGradient id={`${id}-gold`} x2="1" y2="1"><stop stopColor="#ffe6a3"/><stop offset=".5" stopColor="#c49959"/><stop offset="1" stopColor="#8b6033"/></linearGradient>
<linearGradient id={`${id}-green`} x2="1" y2="1"><stop stopColor="#408e73"/><stop offset="1" stopColor="#103c35"/></linearGradient>
<linearGradient id={`${id}-ribbon`}><stop stopColor="#f8d98a"/><stop offset=".5" stopColor="#fff0c4"/><stop offset="1" stopColor="#d0993c"/></linearGradient>
</defs>
<ellipse cx="121" cy="156" rx="108" ry="10" fill="#030918" opacity=".35"/>
<g transform="rotate(5 177 110)">
<rect x="143" y="69" width="74" height="84" rx="4" fill={`url(#${id}-green)`}/>
<path d="M150 91h60M150 112h60M150 133h60" stroke="#c1e7d4" opacity=".16" strokeDasharray="2 7"/>
<rect x="140" y="63" width="80" height="17" rx="3" fill={`url(#${id}-green)`} stroke="#a5d4bf" strokeOpacity=".3"/>
<path d="M174 64h12v89h-12zM143 106h74v10h-74z" fill={`url(#${id}-ribbon)`}/>
<path d="M180 64c-36-1-32-33-13-22 8 5 13 22 13 22Zm0 0c35-1 30-33 12-22-8 5-12 22-12 22Z" stroke="#f1ce7e" strokeWidth="7"/>
<circle cx="180" cy="64" r="6" fill="#fff0bd"/>
</g>
<rect x="65" y="57" width="94" height="98" rx="4" fill={`url(#${id}-gold)`}/>
<path d="M72 76h78M72 99h78M72 122h78" stroke="#ffe8b1" opacity=".25" strokeDasharray="2 9"/>
<rect x="60" y="50" width="104" height="21" rx="4" fill={`url(#${id}-gold)`} stroke="#ffe6ba" strokeOpacity=".4"/>
<path d="M103 51h17v104h-17zM65 108h94v14H65z" fill={`url(#${id}-red)`}/>
<path d="M112 51C62 49 69 9 94 24c12 7 18 27 18 27Zm0 0c48-2 41-42 17-27-11 7-17 27-17 27Z" stroke="#bc2642" strokeWidth="10"/>
<path d="m106 50-19 34 14-4 5 9 9-38m1 0 18 32-12-3-5 9-8-37" fill="#a71936"/>
<circle cx="112" cy="50" r="8" fill="#ef7582"/>
<g transform="rotate(-7 51 133)">
<rect x="17" y="106" width="79" height="50" rx="4" fill={`url(#${id}-red)`}/>
<rect x="13" y="98" width="87" height="15" rx="3" fill={`url(#${id}-red)`} stroke="#ffb3b4" strokeOpacity=".45"/>
<path d="M48 99h14v57H48zM17 128h79v9H17z" fill={`url(#${id}-ribbon)`}/>
<path d="M55 98c-34-1-28-27-13-18 8 4 13 18 13 18Zm0 0c33-1 27-27 12-18-7 4-12 18-12 18Z" stroke="#f8d98a" strokeWidth="6"/>
<circle cx="55" cy="98" r="5" fill="#fff2c7"/>
</g>
<path d="M16 155q20-5 37 0t40 0q30-4 55 0t69-1" stroke="#e9f3ff" strokeWidth="4" strokeLinecap="round" opacity=".8"/>
</svg>
  )
}
