import React, { useMemo, useState } from "react";
import { Play, Search, Shuffle, Bookmark, Home, Compass, Youtube, Instagram, Link2, Settings2, ExternalLink, X, Sparkles, Menu, LoaderCircle } from "lucide-react";

const topics = ["Street food", "Football", "Coding", "Travel", "Comedy", "Music"];
export default function App() {
  const [tab,setTab]=useState("For you"),[query,setQuery]=useState(""),[items,setItems]=useState([]),[saved,setSaved]=useState([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[modal,setModal]=useState(false),[reel,setReel]=useState(""),[mobile,setMobile]=useState(false);
  async function search(q=query,random=false) {
    const term=random?topics[Math.floor(Math.random()*topics.length)]:q.trim();
    if(!term){setNotice("Enter a topic to search.");return;}
    setBusy(true);setNotice("");
    try { const r=await fetch("/api/youtube?q="+encodeURIComponent(term));const d=await r.json();if(!r.ok)throw new Error(d.error||"Search failed");setItems(d.items||[]);setTab("YouTube");if(!d.items?.length)setNotice("No videos found. Try another topic."); }
    catch(e){setNotice(e.message);} finally{setBusy(false);}
  }
  function addReel(){if(!/^https?:\\/\\/(www\\.)?instagram\\.com\\/(reel|reels|p)\\//i.test(reel.trim())){setNotice("Paste a valid public Instagram Reel URL.");return;}setItems(old=>[{id:"ig-"+Date.now(),platform:"instagram",title:"Instagram Reel",channel:"Instagram",url:reel.trim()},...old]);setReel("");setTab("Instagram");setNotice("Public Reel added to your feed.");}
  const shown=useMemo(()=>items.filter(v=>tab==="Saved"?saved.includes(v.id):tab==="YouTube"?v.platform==="youtube":tab==="Instagram"?v.platform==="instagram":true),[items,tab,saved]);
  return <div className="shell">
    <aside className={mobile?"sidebar open":"sidebar"}><div className="brand"><i><Play size={17} fill="currentColor"/></i>reelflow<span>.</span></div><small className="muted label">YOUR SPACE</small>
      {[[ "For you",Home],["Explore",Compass],["YouTube",Youtube],["Instagram",Instagram],["Saved",Bookmark]].map(([n,I])=><button key={n} className={"nav "+(tab===n?"active":"")} onClick={()=>{setTab(n);setMobile(false)}}><I size={18}/>{n}{n==="Saved"&&saved.length>0?<b>{saved.length}</b>:null}</button>)}
      <div className="sidebottom"><div className="connecthint"><Link2 size={18}/><div><b>Connect your world</b><small>Bring both feeds together</small></div></div><button className="nav" onClick={()=>setModal(true)}><Settings2 size={18}/>Connections & settings</button><div className="user"><i>R</i><div><b>Guest viewer</b><small>Personal space</small></div></div></div>
    </aside>
    <main><header><button className="menubtn" onClick={()=>setMobile(!mobile)}><Menu/></button><div className="crumb">Discover <span>/</span> <b>{tab}</b></div><button className="connectbtn" onClick={()=>setModal(true)}><Link2 size={16}/> Connect platforms</button></header>
      <section className="content"><div className="hero"><div><div className="eyebrow"><Sparkles size={13}/> YOUR VIDEO UNIVERSE</div><h1>One feed. <em>Endless</em> discovery.</h1><p>Scroll into something good. Shorts and Reels, together.</p></div><button className="random" onClick={()=>search("",true)}><Shuffle size={16}/> Surprise me</button></div>
        <div className="searchrow"><div className="search"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} placeholder="Search topics, creators, ideas..."/></div><button className="searchbtn" onClick={()=>search()}>Search ↗</button></div>
        <div className="topics"><small>TRY A TOPIC</small>{topics.map(t=><button key={t} onClick={()=>{setQuery(t);search(t)}}>{t}</button>)}</div>
        <div className="feedtitle"><div><h2>{tab==="For you"?"Your next rabbit hole":tab}</h2><p>Discover videos worth your time.</p></div><small>{shown.length} in feed</small></div>
        {notice&&<div className="notice">{notice}<button onClick={()=>setNotice("")}><X size={15}/></button></div>}
        {busy?<div className="loading"><LoaderCircle className="spin"/> Finding videos...</div>:<div className="grid">{shown.map(v=><article className="video" key={v.id}><div className="frame">{v.platform==="youtube"?<iframe src={"https://www.youtube-nocookie.com/embed/"+v.id+"?controls=1&rel=0"} title={v.title} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen/>:<iframe src={v.url.replace(/\\/$/,"")+"/embed"} title="Instagram Reel" allow="encrypted-media; picture-in-picture" allowFullScreen/>}<span className="tag">{v.platform==="youtube"?<><Youtube size={13}/> SHORTS</>:<><Instagram size={13}/> REELS</>}</span><button className="save" onClick={()=>setSaved(s=>s.includes(v.id)?s.filter(x=>x!==v.id):[...s,v.id])}><Bookmark size={17} fill={saved.includes(v.id)?"currentColor":"none"}/></button></div><div className="meta"><div className="channel">{v.platform==="youtube"?"Y":"◎"}</div><div><b>{v.title}</b><small>{v.channel} · {v.platform}</small></div><a href={v.url} target="_blank" rel="noreferrer"><ExternalLink size={15}/></a></div></article>)}
          {!shown.length&&!busy&&<div className="empty"><Bookmark size={25}/><h3>{tab==="Saved"?"No saved videos yet":"Your feed is ready"}</h3><p>{tab==="Saved"?"Save videos to find them here.":"Search a topic or add an Instagram Reel link to begin."}</p></div>}</div>}
        <div className="addreel"><div className="igicon"><Instagram/></div><div className="addcopy"><b>Found a Reel you love?</b><small>Add a public Instagram Reel URL to your combined feed.</small></div><div className="reelinput"><input value={reel} onChange={e=>setReel(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addReel()} placeholder="Paste Instagram Reel URL..."/><button onClick={addReel}>Add Reel</button></div></div>
        <footer><b>reelflow<span>.</span></b><small>Made for the curious · Content stays on its original platform.</small></footer>
      </section>
    </main>
    {modal&&<div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setModal(false)}><div className="modal"><button className="close" onClick={()=>setModal(false)}><X/></button><div className="eyebrow">PLATFORM CONNECTIONS</div><h2>Bring your feeds together.</h2><p>Connect your accounts and discover in one place.</p>
      <div className="provider"><i className="yt"><Youtube/></i><div><b>YouTube</b><small>Search Shorts by topic using the YouTube Data API.</small></div><span>API setup</span></div>
      <div className="provider"><i className="ig"><Instagram/></i><div><b>Instagram</b><small>Embed supported public Reels. Meta API access is restricted.</small></div><span>Meta setup</span></div>
      <div className="hint">To enable YouTube search, add <code>YOUTUBE_API_KEY</code> in Vercel → Project Settings → Environment Variables. Instagram account OAuth requires a Meta developer app and approved permissions.</div><button className="done" onClick={()=>setModal(false)}>Done</button></div></div>}
  </div>;
}