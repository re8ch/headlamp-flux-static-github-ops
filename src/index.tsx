import React from 'react';
import { registerRoute, registerSidebarEntry } from '@kinvolk/headlamp-plugin/lib';
const DEFAULT_VIEW = 'https://flux-status.re8ch.com/';
function FluxStatic() {
  const [url, setUrl] = React.useState(() => localStorage.getItem('flux-static-view-url') || DEFAULT_VIEW);
  const [draft, setDraft] = React.useState(url);
  return <section style={{height:'calc(100vh - 100px)',display:'flex',flexDirection:'column',gap:8}}>
    <form onSubmit={event => {event.preventDefault();try {const next = new URL(draft);if(next.protocol !== 'https:' || next.username || next.password) return;localStorage.setItem('flux-static-view-url',next.href);setUrl(next.href);}catch {}}}>
      <label>Public Flux view URL <input aria-label="Public Flux view URL" value={draft} onChange={e=>setDraft(e.target.value)} style={{width:400}} /></label><button type="submit">Apply</button>
      <a href={url} target="_blank" rel="noopener noreferrer">Open independently</a>
    </form>
    <iframe title="Flux Static GitHub-Ops" src={url} sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" style={{width:'100%',flex:1,border:0}} />
  </section>;
}
registerSidebarEntry({name:'flux-static-github-ops',url:'/flux-static-github-ops',icon:'mdi:github',parent:'',label:'Flux Static GitHub-Ops'});
registerRoute({path:'/flux-static-github-ops',sidebar:'flux-static-github-ops',name:'Flux Static GitHub-Ops',component:FluxStatic});
