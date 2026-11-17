const svg=p=>`<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const RAW={
 b1:svg('<circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.5M12 7.6h.01"/>'),
 b2:svg('<path d="M12 3l8 3v6c0 4.5-3.2 8.2-8 9-4.8-.8-8-4.5-8-9V6l8-3z"/><path d="M8.6 12l2.4 2.4 4.4-4.8"/>'),
 b3:svg('<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>'),
 b4:svg('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'),
 b5:svg('<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>'),
 b6:svg('<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c3 3 4.5 6 4.5 9.5s-1.5 6.5-4.5 9.5c-3-3-4.5-6-4.5-9.5S9 5.5 12 2.5z"/>'),
 b7:svg('<path d="M3 8l9-4.5L21 8l-9 4.5L3 8z"/><path d="M7 10.5V15c0 1.6 2.2 3 5 3s5-1.4 5-3v-4.5"/>')
};
export const ICO=new Proxy(RAW,{get:(t,k)=>t[k]??t.b1});
