function getApiKey() {
  let key = localStorage.getItem('wos_api_key');
  if (!key) {
    key = prompt('🌤️ Welcome to WeatherOS!\n\nPaste your OpenWeatherMap API key to get started:\n(Get a free key at openweathermap.org)');
    if (key && key.trim()) {
      localStorage.setItem('wos_api_key', key.trim());
    }
  }
  return key ? key.trim() : '';
}
const API_KEY = getApiKey();
let weatherData = null, forecastData = null;
let isFahrenheit = false;
let favorites = JSON.parse(localStorage.getItem('wos_favs') || '[]');
let lightningTimer = null, cloudTimer = null;

// ── THEMES ────────────────────────────────────────────────────────────────
const themes = {
  heat:   {bg1:'#7c2d12',bg2:'#c2410c',bg3:'#ea580c',accent:'#fbbf24',orb1:'#ef4444',orb2:'#fde68a',p:'sun'},
  rain:   {bg1:'#0f172a',bg2:'#1e3a5f',bg3:'#334155',accent:'#93c5fd',orb1:'#3b82f6',orb2:'#bfdbfe',p:'rain'},
  snow:   {bg1:'#1a2744',bg2:'#1e3a5f',bg3:'#2d4a6e',accent:'#a5f3fc',orb1:'#bae6fd',orb2:'#e0f2fe',p:'snow'},
  clear:  {bg1:'#0f0c29',bg2:'#302b63',bg3:'#24243e',accent:'#a78bfa',orb1:'#a78bfa',orb2:'#60a5fa',p:'stars'},
  night:  {bg1:'#020207',bg2:'#0d0d2b',bg3:'#0a0a1e',accent:'#818cf8',orb1:'#4f46e5',orb2:'#1e1b4b',p:'stars'},
  cloudy: {bg1:'#1e293b',bg2:'#334155',bg3:'#475569',accent:'#94a3b8',orb1:'#64748b',orb2:'#94a3b8',p:'clouds'},
  fog:    {bg1:'#1c1c1c',bg2:'#374151',bg3:'#4b5563',accent:'#d1d5db',orb1:'#9ca3af',orb2:'#e5e7eb',p:'none'},
  thunder:{bg1:'#1a0533',bg2:'#2d1b4e',bg3:'#1e0d3a',accent:'#c084fc',orb1:'#7c3aed',orb2:'#a78bfa',p:'rain'},
};

function applyTheme(key) {
  const t = themes[key] || themes.clear;
  document.documentElement.style.setProperty('--bg1', t.bg1);
  document.documentElement.style.setProperty('--bg2', t.bg2);
  document.documentElement.style.setProperty('--bg3', t.bg3);
  document.documentElement.style.setProperty('--accent', t.accent);
  document.querySelector('.orb1').style.background = t.orb1;
  document.querySelector('.orb2').style.background = t.orb2;
  startParticles(t.p);
  // Heat shimmer
  const hs = document.getElementById('heat-shimmer');
  hs.style.opacity = key === 'heat' ? '1' : '0';
  if (key === 'heat') startHeatShimmer();
  // Lightning for thunder
  if (key === 'thunder') startLightning();
  else stopLightning();
  // Clouds for cloudy
  if (t.p === 'clouds') spawnClouds();
  else clearClouds();
}

// ── PARTICLE SYSTEM ──────────────────────────────────────────────────────
const pCanvas = document.getElementById('particle-canvas');
const pCtx = pCanvas.getContext('2d');
let particles = [], pAnimFrame, pType = 'none';
function resizeCanvas() { pCanvas.width = window.innerWidth; pCanvas.height = window.innerHeight; }
resizeCanvas(); window.addEventListener('resize', resizeCanvas);

function startParticles(type) {
  cancelAnimationFrame(pAnimFrame); particles = []; pType = type;
  if (type === 'none') { pCtx.clearRect(0,0,pCanvas.width,pCanvas.height); return; }
  const counts = {rain:130, snow:65, stars:90, sun:50, clouds:0};
  for (let i=0; i<(counts[type]||0); i++) particles.push(makeParticle(type, true));
  animateParticles();
}

function makeParticle(type, random=false) {
  const y = random ? Math.random()*pCanvas.height : -10;
  if (type==='rain')  return {x:Math.random()*pCanvas.width, y, vy:9+Math.random()*7, vx:-1.5, len:12+Math.random()*8, alpha:0.25+Math.random()*0.4};
  if (type==='snow')  return {x:Math.random()*pCanvas.width, y, vy:0.7+Math.random()*1.2, vx:0, r:2+Math.random()*3, alpha:0.5+Math.random()*0.5, drift:Math.random()*Math.PI*2};
  if (type==='stars') return {x:Math.random()*pCanvas.width, y:Math.random()*pCanvas.height, r:Math.random()*1.5, alpha:Math.random(), pulse:Math.random()*Math.PI*2};
  if (type==='sun')   return {x:Math.random()*pCanvas.width, y:random?Math.random()*pCanvas.height:-10, vy:0.3+Math.random()*0.5, r:1+Math.random()*2, alpha:0.08+Math.random()*0.2, pulse:Math.random()*Math.PI*2};
}

function animateParticles() {
  pCtx.clearRect(0,0,pCanvas.width,pCanvas.height);
  particles.forEach((p,i) => {
    if (pType==='rain') {
      pCtx.beginPath(); pCtx.strokeStyle=`rgba(147,197,253,${p.alpha})`; pCtx.lineWidth=1;
      pCtx.moveTo(p.x,p.y); pCtx.lineTo(p.x+p.vx*3,p.y+p.len); pCtx.stroke();
      p.x+=p.vx; p.y+=p.vy;
      if (p.y>pCanvas.height) particles[i]=makeParticle('rain');
    } else if (pType==='snow') {
      p.drift+=0.02; p.x+=Math.sin(p.drift)*0.6; p.y+=p.vy;
      pCtx.beginPath(); pCtx.arc(p.x,p.y,p.r,0,Math.PI*2);
      pCtx.fillStyle=`rgba(220,240,255,${p.alpha})`; pCtx.fill();
      if (p.y>pCanvas.height) particles[i]=makeParticle('snow');
    } else if (pType==='stars') {
      p.pulse+=0.018;
      pCtx.beginPath(); pCtx.arc(p.x,p.y,p.r,0,Math.PI*2);
      pCtx.fillStyle=`rgba(255,255,255,${p.alpha*(0.5+0.5*Math.sin(p.pulse))})`; pCtx.fill();
    } else if (pType==='sun') {
      p.pulse+=0.015; p.y-=p.vy;
      pCtx.beginPath(); pCtx.arc(p.x,p.y,p.r,0,Math.PI*2);
      pCtx.fillStyle=`rgba(251,191,36,${p.alpha*(0.5+0.5*Math.sin(p.pulse))})`; pCtx.fill();
      if (p.y<-10) particles[i]=makeParticle('sun');
    }
  });
  pAnimFrame = requestAnimationFrame(animateParticles);
}

// ── HEAT SHIMMER ────────────────────────────────────────────────────────
let shimmerFrame;
function startHeatShimmer() {
  const c = document.getElementById('shimmer-canvas');
  c.width = window.innerWidth; c.height = window.innerHeight;
  const ctx = c.getContext('2d');
  let t = 0;
  function draw() {
    ctx.clearRect(0,0,c.width,c.height);
    for (let y=c.height*0.5; y<c.height; y+=4) {
      const wave = Math.sin(y*0.05 + t) * 3;
      ctx.beginPath();
      ctx.moveTo(0,y); ctx.lineTo(c.width,y+wave);
      ctx.strokeStyle = `rgba(255,150,50,${0.015 + Math.sin(y*0.1+t)*0.008})`;
      ctx.lineWidth = 2; ctx.stroke();
    }
    t += 0.04;
    shimmerFrame = requestAnimationFrame(draw);
  }
  cancelAnimationFrame(shimmerFrame); draw();
}

// ── LIGHTNING FLASH ────────────────────────────────────────────────────
function startLightning() {
  stopLightning();
  function flash() {
    const overlay = document.getElementById('lightning-overlay');
    const delay = 3000 + Math.random()*8000;
    lightningTimer = setTimeout(() => {
      overlay.style.background = `rgba(220,200,255,${0.3+Math.random()*0.4})`;
      setTimeout(() => {
        overlay.style.background = 'rgba(220,200,255,0)';
        setTimeout(() => {
          if (Math.random() > 0.5) {
            setTimeout(() => {
              overlay.style.background = `rgba(220,200,255,${0.15+Math.random()*0.2})`;
              setTimeout(() => { overlay.style.background = 'rgba(220,200,255,0)'; }, 60);
            }, 120);
          }
        }, 100);
      }, 80);
      flash();
    }, delay);
  }
  flash();
}
function stopLightning() {
  clearTimeout(lightningTimer);
  document.getElementById('lightning-overlay').style.background = 'rgba(220,200,255,0)';
}

// ── DRIFTING CLOUDS ───────────────────────────────────────────────────
function spawnClouds() {
  clearClouds();
  const layer = document.getElementById('cloud-layer');
  const cloudSVGs = [
    `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg"><ellipse cx="100" cy="55" rx="90" ry="28" fill="rgba(255,255,255,0.06)"/><ellipse cx="70" cy="42" rx="50" ry="32" fill="rgba(255,255,255,0.05)"/><ellipse cx="130" cy="40" rx="45" ry="30" fill="rgba(255,255,255,0.05)"/></svg>`,
    `<svg viewBox="0 0 280 90" xmlns="http://www.w3.org/2000/svg"><ellipse cx="140" cy="62" rx="130" ry="30" fill="rgba(255,255,255,0.05)"/><ellipse cx="100" cy="46" rx="65" ry="38" fill="rgba(255,255,255,0.04)"/><ellipse cx="180" cy="44" rx="60" ry="36" fill="rgba(255,255,255,0.04)"/></svg>`,
  ];
  for (let i=0; i<5; i++) {
    const div = document.createElement('div');
    div.className = 'drift-cloud';
    div.innerHTML = cloudSVGs[i%cloudSVGs.length];
    const size = 200 + Math.random()*200;
    div.style.width = size+'px';
    div.style.top = (Math.random()*60)+'%';
    div.style.animationDuration = (35+Math.random()*30)+'s';
    div.style.animationDelay = (-Math.random()*30)+'s';
    layer.appendChild(div);
  }
}
function clearClouds() {
  document.getElementById('cloud-layer').innerHTML = '';
}

// ── WEATHER SCORE ─────────────────────────────────────────────────────
function getWeatherScore(tc, isRain, isSnow, isThunder, windKph, humidity, uvIdx) {
  let score = 100;
  if (isThunder) score -= 50;
  else if (isSnow) score -= 25;
  else if (isRain) score -= 20;
  if (tc > 38) score -= 30;
  else if (tc > 33) score -= 15;
  else if (tc < 0)  score -= 30;
  else if (tc < 8)  score -= 15;
  else if (tc >= 20 && tc <= 28) score += 5;
  if (windKph > 60) score -= 20;
  else if (windKph > 40) score -= 10;
  if (humidity > 85) score -= 10;
  if (uvIdx > 8) score -= 10;
  score = Math.max(0, Math.min(100, score));
  let label, color;
  if (score >= 80) { label='Excellent'; color='#4ade80'; }
  else if (score >= 60) { label='Good'; color='#a3e635'; }
  else if (score >= 40) { label='Fair'; color='#fbbf24'; }
  else if (score >= 20) { label='Poor'; color='#f97316'; }
  else { label='Bad'; color='#f87171'; }
  return { score, label, color };
}

// ── BEST TIME OUTSIDE ─────────────────────────────────────────────────
function getBestTimeOutside(forecastList, sunrise, sunset) {
  if (!forecastList) return null;
  const now = Date.now()/1000;
  const upcoming = forecastList.filter(h => h.dt >= now && h.dt <= now+86400).slice(0,8);
  if (!upcoming.length) return null;
  let best = null, bestScore = -1;
  upcoming.forEach(h => {
    const tc = h.main.temp, wind = h.wind?.speed*3.6||0, hum = h.main.humidity;
    const rain = h.pop||0, id = h.weather[0].id;
    const hr = new Date(h.dt*1000).getHours();
    const isDaylight = h.dt > (sunrise||0) && h.dt < (sunset||99999999);
    let s = 100;
    if (id>=200&&id<600) s -= 40;
    if (tc>33||tc<8) s -= 20;
    if (wind>40) s -= 15;
    if (hum>85) s -= 10;
    if (rain>0.5) s -= 20;
    if (!isDaylight) s -= 10;
    if (tc>=20&&tc<=28) s += 10;
    if (s > bestScore) { bestScore=s; best=h; }
  });
  if (!best) return null;
  const d = new Date(best.dt*1000);
  const hr = d.getHours();
  const label = hr===0?'12am':hr<12?`${hr}am`:hr===12?'12pm':`${hr-12}pm`;
  return { time: label, score: bestScore, data: best, items: upcoming };
}

// ── AQI ENGINE ─────────────────────────────────────────────────────────
function getAQIData(aqi) {
  // aqi: 1=Good, 2=Fair, 3=Moderate, 4=Poor, 5=VeryPoor (OpenWeatherMap scale)
  const map = {
    1: {label:'Good',      color:'#4ade80', desc:'Air quality is great. No precautions needed.',      pct:10},
    2: {label:'Fair',      color:'#a3e635', desc:'Acceptable air. Sensitive groups take care outdoors.',pct:28},
    3: {label:'Moderate',  color:'#fbbf24', desc:'Sensitive groups may experience effects outside.',   pct:50},
    4: {label:'Poor',      color:'#f97316', desc:'Everyone may experience health effects. Limit outdoor exposure.',pct:72},
    5: {label:'Very Poor', color:'#f87171', desc:'Health warning. Avoid prolonged outdoor activity.',  pct:92},
  };
  return map[aqi] || {label:'N/A', color:'#94a3b8', desc:'No AQI data available.', pct:0};
}

// ── POLLEN ENGINE ──────────────────────────────────────────────────────
function getPollenLevels(tc, isRain, month) {
  // Simulate pollen based on season/conditions — real data needs paid API
  const spring = month >= 2 && month <= 5;
  const summer = month >= 5 && month <= 8;
  const isWet = isRain;
  const getLevel = (base) => {
    if (isWet) return Math.max(0, base-2);
    return base;
  };
  const levels = ['Low','Low','Moderate','High','Very High'];
  const tree   = spring ? getLevel(3) : summer ? getLevel(1) : 0;
  const grass  = summer ? getLevel(4) : spring ? getLevel(2) : 0;
  const weed   = summer||spring ? getLevel(2) : 0;
  const cls    = (v) => v<=1?'p-low':v<=2?'p-mod':v<=3?'p-high':'p-vhigh';
  return [
    {emoji:'🌳', type:'Tree',  level:levels[tree],  cls:cls(tree)},
    {emoji:'🌿', type:'Grass', level:levels[grass], cls:cls(grass)},
    {emoji:'🌾', type:'Weed',  level:levels[weed],  cls:cls(weed)},
  ];
}

// ── COMMUTE ADVISOR ────────────────────────────────────────────────────
function getCommuteRatings(tc, isRain, isSnow, isThunder, windKph, visibility) {
  const modes = [
    { mode:'Drive',  icon:'🚗', key:'drive' },
    { mode:'Cycle',  icon:'🚴', key:'cycle' },
    { mode:'Walk',   icon:'🚶', key:'walk'  },
  ];
  function rate(key) {
    let score = 5;
    if (key==='drive') {
      if (isThunder) score=3;
      else if (isSnow) score=2;
      else if (isRain) score=3;
      if (visibility < 2000) score=Math.min(score,2);
    } else if (key==='cycle') {
      if (isThunder||isSnow) score=1;
      else if (isRain) score=2;
      else if (windKph>40) score=2;
      else if (tc<5||tc>35) score=3;
      else if (tc>=15&&tc<=28&&windKph<20) score=5;
    } else if (key==='walk') {
      if (isThunder) score=1;
      else if (isSnow) score=2;
      else if (isRain) score=2;
      else if (tc<3||tc>36) score=2;
      else if (windKph>50) score=2;
      else if (tc>=18&&tc<=26) score=5;
    }
    return score;
  }
  const notes = {
    drive: {
      1:'Dangerous — avoid if possible', 2:'Hazardous — slow down, full focus',
      3:'Take care — reduced visibility', 4:'Fine — normal caution', 5:'Clear roads ahead'
    },
    cycle: {
      1:'Too dangerous to cycle', 2:'Not recommended today',
      3:'Possible but unpleasant', 4:'Good conditions', 5:'Perfect cycling weather'
    },
    walk: {
      1:'Stay indoors', 2:'Only if necessary',
      3:'Dress for conditions', 4:'Nice walk today', 5:'Perfect walking weather'
    }
  };
  const rated = modes.map(m => ({...m, rating: rate(m.key), note: notes[m.key][rate(m.key)]}));
  const best = rated.reduce((a,b) => a.rating>b.rating ? a : b);
  return rated.map(m => ({...m, recommended: m.key===best.key, avoid: m.rating<=2}));
}

// ── LOGIC ────────────────────────────────────────────────────────────────
function getAdvice(tc, wKph, isRain, isSnow, isThunder) {
  if (isThunder) return "⛈️ Thunderstorm warning! Stay indoors, unplug electronics, avoid trees.";
  if (isSnow)    return "❄️ Snow day! Layer up, watch your step on ice, and maybe skip the car.";
  if (isRain)    return "🌧️ Wet socks alert! Waterproof your shoes and expect traffic delays.";
  if (tc > 35)   return "🔥 Scorching. Reapply SPF every 2 hrs, find shade, hydrate constantly.";
  if (tc > 28)   return "☀️ Hot one today. Light fabrics, sunscreen, and cold drinks only.";
  if (tc < 0)    return "🥶 Freezing! Thermal layers, insulated boots — frostbite risk is real.";
  if (tc < 8)    return "🧣 Heavy coat required. Don't forget your scarf and gloves.";
  if (tc < 15)   return "🧥 Chilly out. A jacket will carry you through the day.";
  if (wKph > 50) return "💨 Extremely windy — hold onto your hat, avoid open exposed areas.";
  return "🌤️ T-shirt weather! Grab a cold brew and enjoy the sun.";
}

function getOutfit(tc, isRain, isSnow) {
  if (isSnow) return ['🧥 Puffer','🧤 Gloves','🥾 Snow boots','🎩 Beanie'];
  if (isRain) return ['🌂 Umbrella','🥾 Waterproof boots','🧥 Rain jacket'];
  if (tc > 30) return ['👕 Light tee','🩳 Shorts','🕶️ Sunglasses','🧴 SPF50'];
  if (tc > 20) return ['👕 T-shirt','👖 Jeans','👟 Sneakers'];
  if (tc > 12) return ['🧥 Light jacket','👖 Trousers','👟 Sneakers'];
  return ['🧥 Heavy coat','🧣 Scarf','🧤 Gloves','🥾 Warm boots'];
}

function getVibe(tc, isRain, isSnow, isNight, isThunder) {
  if (isThunder) return {icon:'fa-bolt',       label:'Dark Techno'};
  if (isSnow)    return {icon:'fa-snowflake',  label:'Cozy Ambient'};
  if (isRain)    return {icon:'fa-cloud-rain', label:'Lo-Fi Beats'};
  if (isNight)   return {icon:'fa-moon',       label:'Midnight Jazz'};
  if (tc > 32)   return {icon:'fa-sun',        label:'Tropical House'};
  if (tc < 8)    return {icon:'fa-wind',       label:'Nordic Folk'};
  return {icon:'fa-music', label:'Indie Pop'};
}

function getMood(tc, isRain, isSnow, isThunder) {
  if (isThunder) return {emoji:'😨', text:'Anxious & Stormy'};
  if (isSnow)    return {emoji:'🤩', text:'Wonderstruck & Cozy'};
  if (isRain)    return {emoji:'😌', text:'Calm & Reflective'};
  if (tc > 33)   return {emoji:'😅', text:'Sweaty But Happy'};
  if (tc > 24)   return {emoji:'😎', text:'Vibing Hard'};
  if (tc < 5)    return {emoji:'🥶', text:'Frozen But Alive'};
  return {emoji:'😊', text:'Genuinely Good'};
}

function getWFH(tc, isRain, isSnow, isThunder, wKph) {
  if (isThunder||isSnow) return {cls:'wfh-yes',icon:'fa-house',label:'Def WFH today'};
  if (isRain||wKph>40)   return {cls:'wfh-yes',icon:'fa-house',label:'Stay in, WFH'};
  if (tc>32||tc<3)       return {cls:'wfh-meh',icon:'fa-scale-balanced',label:'WFH optional'};
  return {cls:'wfh-no',icon:'fa-briefcase',label:'Go to the office'};
}

function getWeatherIcon(id, isNight) {
  if (id>=200&&id<300) return 'fa-cloud-bolt';
  if (id>=300&&id<400) return 'fa-cloud-drizzle';
  if (id>=500&&id<600) return 'fa-cloud-showers-heavy';
  if (id>=600&&id<700) return 'fa-snowflake';
  if (id>=700&&id<800) return 'fa-smog';
  if (id===800)        return isNight ? 'fa-moon' : 'fa-sun';
  if (id<=802)         return 'fa-cloud-sun';
  return 'fa-cloud';
}

function getThemeKey(tc, id, isNight) {
  if (id>=200&&id<300) return 'thunder';
  if (id>=600&&id<700) return 'snow';
  if (id>=500&&id<600) return 'rain';
  if (id>=300&&id<400) return 'rain';
  if (id>=700&&id<800) return 'fog';
  if (id>800)          return 'cloudy';
  if (tc>32)           return 'heat';
  if (isNight)         return 'night';
  return 'clear';
}

function getUVLabel(uv) {
  if (!uv && uv!==0) return {label:'N/A',color:'#94a3b8',pct:0};
  if (uv<3)  return {label:'Low',     color:'#4ade80', pct:Math.min(uv/11*100,100)};
  if (uv<6)  return {label:'Mod',     color:'#fbbf24', pct:Math.min(uv/11*100,100)};
  if (uv<8)  return {label:'High',    color:'#f97316', pct:Math.min(uv/11*100,100)};
  if (uv<11) return {label:'V.High',  color:'#ef4444', pct:Math.min(uv/11*100,100)};
  return {label:'Extreme',color:'#a855f7',pct:100};
}

// ── LIVE CLOCK ────────────────────────────────────────────────────────
function startClock() {
  function tick() {
    const el = document.getElementById('live-clock');
    if (el) el.textContent = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }
  tick(); setInterval(tick, 1000);
}

// ── COUNTER ANIMATION ──────────────────────────────────────────────────
function animateCounter(el, from, to, duration=700) {
  const start = performance.now();
  const update = (now) => {
    const p = Math.min((now-start)/duration, 1);
    el.textContent = Math.round(from + (to-from)*(1-Math.pow(1-p,3)));
    if (p<1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ── SUN ARC ───────────────────────────────────────────────────────────
function drawSunArc(canvasEl, sunrise, sunset) {
  const c = canvasEl.getContext('2d');
  const W = canvasEl.width = canvasEl.offsetWidth * devicePixelRatio;
  const H = canvasEl.height = canvasEl.offsetHeight * devicePixelRatio;
  c.scale(devicePixelRatio, devicePixelRatio);
  const w = canvasEl.offsetWidth, h = canvasEl.offsetHeight;
  const cx=w/2, cy=h+10, rx=w*0.45, ry=h*1.1;
  const now=Date.now()/1000;
  const pct = Math.max(0, Math.min(1, (now-sunrise)/(sunset-sunrise)));
  c.beginPath(); c.ellipse(cx,cy,rx,ry,0,Math.PI,0);
  c.strokeStyle='rgba(255,255,255,0.08)'; c.lineWidth=2; c.stroke();
  const grd=c.createLinearGradient(cx-rx,0,cx+rx,0);
  grd.addColorStop(0,'#f97316'); grd.addColorStop(1,'#fbbf24');
  c.beginPath(); c.ellipse(cx,cy,rx,ry,0,Math.PI,Math.PI-pct*Math.PI,true);
  c.strokeStyle=grd; c.lineWidth=3; c.stroke();
  const angle=Math.PI+pct*Math.PI;
  const sx=cx+rx*Math.cos(angle), sy=cy+ry*Math.sin(angle);
  c.beginPath(); c.arc(sx,sy,6,0,Math.PI*2);
  c.fillStyle='#fbbf24'; c.shadowBlur=14; c.shadowColor='#fbbf24'; c.fill(); c.shadowBlur=0;
}

// ── HOURLY HTML ────────────────────────────────────────────────────────
function renderHourly(list) {
  const now=Date.now()/1000;
  return list.filter(h=>h.dt>=now).slice(0,8).map((h,i) => {
    const d=new Date(h.dt*1000), hr=d.getHours();
    const label=hr===0?'12am':hr<12?`${hr}am`:hr===12?'12pm':`${hr-12}pm`;
    const tc=h.main.temp;
    const disp=isFahrenheit?Math.round(tc*9/5+32):Math.round(tc);
    const icon=getWeatherIcon(h.weather[0].id, hr<6||hr>=20);
    const rain=h.pop?Math.round(h.pop*100)+'%':'';
    return `<div class="hour-item${i===0?' active':''}">
      <div class="hour-time">${label}</div>
      <div class="hour-icon"><i class="fa-solid ${icon}" style="color:var(--accent)"></i></div>
      <div class="hour-temp">${disp}°</div>
      ${rain?`<div class="hour-rain"><i class="fa-solid fa-droplet" style="font-size:8px"></i> ${rain}</div>`:''}
    </div>`;
  }).join('');
}

// ── DAILY HTML ─────────────────────────────────────────────────────────
function renderDaily(list) {
  const days={}, dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  list.forEach(item => {
    const d=new Date(item.dt*1000), key=d.toDateString();
    if (!days[key]) days[key]={name:dayNames[d.getDay()],items:[]};
    days[key].items.push(item);
  });
  const unit = isFahrenheit?'°F':'°C';
  return Object.values(days).slice(1,6).map(day => {
    const temps=day.items.map(i=>i.main.temp);
    const hi=Math.max(...temps), lo=Math.min(...temps);
    const hiD=isFahrenheit?Math.round(hi*9/5+32):Math.round(hi);
    const loD=isFahrenheit?Math.round(lo*9/5+32):Math.round(lo);
    const rep=day.items[Math.floor(day.items.length/2)];
    const icon=getWeatherIcon(rep.weather[0].id, false);
    return `<div class="day-row">
      <span class="day-name">${day.name}</span>
      <span class="day-icon"><i class="fa-solid ${icon}" style="color:var(--accent)"></i></span>
      <span class="day-desc">${rep.weather[0].description}</span>
      <div class="day-temps"><span class="day-hi">${hiD}${unit}</span><span class="day-lo">${loD}${unit}</span></div>
    </div>`;
  }).join('');
}

// ── BEST TIME BAR HTML ─────────────────────────────────────────────────
function renderBestTimeBar(items, bestDt) {
  const now=Date.now()/1000;
  const maxScore = 100;
  return items.map(h => {
    const d=new Date(h.dt*1000), hr=d.getHours();
    const label=hr===0?'12a':hr<12?`${hr}a`:hr===12?'12p':`${hr-12}p`;
    const tc=h.main.temp, rain=h.pop||0, id=h.weather[0].id;
    let s=100;
    if (id>=200&&id<600) s-=40;
    if (tc>33||tc<8) s-=20;
    if (rain>0.5) s-=20;
    if (tc>=20&&tc<=28) s+=10;
    s=Math.max(10,Math.min(100,s));
    const isBest = h.dt===bestDt;
    const color = isBest ? 'var(--accent)' : s>70?'rgba(74,222,128,0.5)':s>40?'rgba(251,191,36,0.5)':'rgba(248,113,113,0.4)';
    return `<div class="bt-bar${isBest?' best':''}" style="height:${s}%;background:${color};border-radius:4px 4px 0 0;" title="${label}: Score ${s}"></div>`;
  }).join('');
}

// ── STORM ALERT ────────────────────────────────────────────────────────
function renderStormAlert(id, windKph, forecastList) {
  const wrap = document.getElementById('storm-alert-wrap');
  let msg = null;
  if (id>=200&&id<300) msg = {title:'⚡ Thunderstorm Active', desc:'Lightning risk is high. Stay indoors and away from windows.'};
  else if (windKph>70) msg = {title:'💨 Severe Wind Warning', desc:`Winds at ${Math.round(windKph)} km/h. Secure loose objects outdoors.`};
  else if (forecastList) {
    const soon = forecastList.slice(0,4).find(h=>h.weather[0].id>=200&&h.weather[0].id<300);
    if (soon) {
      const d=new Date(soon.dt*1000), hr=d.getHours();
      const label=hr===0?'12am':hr<12?`${hr}am`:hr===12?'12pm':`${hr-12}pm`;
      msg = {title:`⛈️ Storm Expected at ${label}`, desc:'Thunderstorm approaching. Plan indoor activities around this time.'};
    }
  }
  if (msg) {
    wrap.innerHTML = `<div class="card storm-alert">
      <div class="storm-alert-icon">🚨</div>
      <div class="storm-alert-text">
        <div class="storm-alert-title">${msg.title}</div>
        <div class="storm-alert-desc">${msg.desc}</div>
      </div>
    </div>`;
  } else {
    wrap.innerHTML = '';
  }
}

// ── SCORE RING HTML ────────────────────────────────────────────────────
function buildScoreRing(score, color) {
  const r=36, circ=2*Math.PI*r;
  const offset = circ - (score/100)*circ;
  return `<svg width="90" height="90" viewBox="0 0 90 90">
    <circle class="score-ring-bg" cx="45" cy="45" r="${r}"/>
    <circle class="score-ring-fill" cx="45" cy="45" r="${r}"
      stroke="${color}"
      stroke-dasharray="${circ}"
      stroke-dashoffset="${circ}"
      id="score-ring-path"
    />
  </svg>
  <div class="score-center">
    <div class="score-num" style="color:${color}" id="score-num">0</div>
    <div class="score-lbl">Score</div>
  </div>`;
}

// ── MAIN RENDER ──────────────────────────────────────────────────────
function renderWeather(data, forecast, aqiData) {
  weatherData = data; forecastData = forecast;
  const tc=data.main.temp, feelsC=data.main.feels_like;
  const humidity=data.main.humidity, windMs=data.wind.speed;
  const windKph=windMs*3.6, pressure=data.main.pressure;
  const id=data.weather[0].id, desc=data.weather[0].description;
  const city=data.name+(data.sys?.country?', '+data.sys.country:'');
  const visibility=data.visibility?(data.visibility/1000).toFixed(1)+'km':'N/A';
  const isRain=id>=300&&id<600, isSnow=id>=600&&id<700, isThunder=id>=200&&id<300;
  const hour=new Date().getHours(), isNight=hour<6||hour>=20;
  const sunrise=data.sys?.sunrise, sunset=data.sys?.sunset;
  const sunriseStr=sunrise?new Date(sunrise*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'--';
  const sunsetStr=sunset?new Date(sunset*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'--';
  const uvIdx=data.uvi||0;
  const month=new Date().getMonth();

  applyTheme(getThemeKey(tc, id, isNight));
  renderStormAlert(id, windKph, forecast?.list);

  const dispTemp=isFahrenheit?Math.round(tc*9/5+32):Math.round(tc);
  const dispFeels=isFahrenheit?Math.round(feelsC*9/5+32):Math.round(feelsC);
  const unit=isFahrenheit?'°F':'°C';

  const advice    = getAdvice(tc, windKph, isRain, isSnow, isThunder);
  const outfit    = getOutfit(tc, isRain, isSnow);
  const vibe      = getVibe(tc, isRain, isSnow, isNight, isThunder);
  const mood      = getMood(tc, isRain, isSnow, isThunder);
  const wfh       = getWFH(tc, isRain, isSnow, isThunder, windKph);
  const iconCls   = getWeatherIcon(id, isNight);
  const uvData    = getUVLabel(uvIdx);
  const wscore    = getWeatherScore(tc, isRain, isSnow, isThunder, windKph, humidity, uvIdx);
  const commute   = getCommuteRatings(tc, isRain, isSnow, isThunder, windKph, data.visibility||10000);
  const pollen    = getPollenLevels(tc, isRain, month);
  const isFav     = favorites.includes(data.name);
  const now_str   = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const feelsNote = feelsC>tc+3?'Humidity makes it hotter':feelsC<tc-3?'Wind chill effect':'About right';

  const aqiInfo = aqiData ? getAQIData(aqiData) : getAQIData(Math.ceil(Math.random()*3)); // fallback estimate

  const hourlyHTML = forecast ? renderHourly(forecast.list) : '';
  const dailyHTML  = forecast ? renderDaily(forecast.list) : '';

  const bestTime = getBestTimeOutside(forecast?.list, sunrise, sunset);
  const bestBarHTML = bestTime ? renderBestTimeBar(bestTime.items, bestTime.data.dt) : '';
  const btLabels = bestTime ? bestTime.items.map(h=>{const hr=new Date(h.dt*1000).getHours();return hr===0?'12a':hr<12?`${hr}a`:hr===12?'12p':`${hr-12}p`;}).join('') : '';

  document.getElementById('main-card').innerHTML = `
    <div class="main-top">
      <div class="clock-row"><span id="live-clock"></span></div>
      <div class="top-bar">
        <span class="app-label"><i class="fa-solid fa-satellite-dish" style="margin-right:6px;font-size:10px;"></i>WeatherOS</span>
        <div class="controls">
          <div class="toggle-wrap">
            <span class="toggle-lbl">°C</span>
            <label class="toggle">
              <input type="checkbox" id="unit-toggle" ${isFahrenheit?'checked':''}>
              <span class="t-track"></span><span class="t-thumb"></span>
            </label>
            <span class="toggle-lbl">°F</span>
          </div>
          <button id="fav-btn" class="${isFav?'active':''}" title="Save city">
            <i class="fa-${isFav?'solid':'regular'} fa-star"></i>
          </button>
        </div>
      </div>

      <!-- Score ring + temp -->
      <div class="score-wrap">
        <div class="score-ring-outer">${buildScoreRing(wscore.score, wscore.color)}</div>
        <div class="score-right">
          <div id="location-name"><i class="fa-solid fa-location-dot" style="font-size:10px;margin-right:5px;"></i>${city}</div>
          <div id="temp-display"><span id="temp-num">${dispTemp}</span><span style="font-size:36px;letter-spacing:0;font-weight:700;">${unit}</span></div>
          <div id="condition-text">${desc.charAt(0).toUpperCase()+desc.slice(1)}</div>
        </div>
      </div>

      <div class="icon-stats">
        <div class="weather-icon-main"><i class="fa-solid ${iconCls}"></i></div>
        <div class="stats-grid">
          <div class="stat-item"><i class="fa-solid fa-temperature-half"></i> Feels ${dispFeels}${unit}</div>
          <div class="stat-item"><i class="fa-solid fa-droplet"></i> ${humidity}% humid</div>
          <div class="stat-item"><i class="fa-solid fa-wind"></i> ${Math.round(windKph)} km/h</div>
          <div class="stat-item"><i class="fa-solid fa-gauge"></i> ${pressure} hPa</div>
          <div class="stat-item"><i class="fa-solid fa-eye"></i> ${visibility}</div>
          <div class="stat-item"><i class="fa-solid fa-comment-dots"></i> ${feelsNote}</div>
        </div>
      </div>
    </div>

    <div class="sec-div"></div>

    <!-- Human Advice -->
    <div class="advice-section">
      <span class="sec-label">Human Advice</span>
      <div id="human-advice">${advice}</div>
      <div class="outfit-row">${outfit.map(o=>`<span class="outfit-tag">${o}</span>`).join('')}</div>
    </div>

    <div class="sec-div"></div>

    <!-- Best Time Outside -->
    ${bestTime ? `
    <div class="besttime-section">
      <span class="sec-label">Best Time to Go Outside</span>
      <div class="besttime-bar">
        ${bestBarHTML}
      </div>
      <div class="bt-labels">
        ${bestTime.items.map(h=>{const hr=new Date(h.dt*1000).getHours();return`<span class="bt-label">${hr===0?'12a':hr<12?`${hr}a`:hr===12?'12p':`${hr-12}p`}</span>`;}).join('')}
      </div>
      <div class="besttime-badge"><i class="fa-solid fa-clock-rotate-left"></i> Optimal window: around ${bestTime.time}</div>
    </div>
    <div class="sec-div"></div>` : ''}

    <!-- AQI -->
    <div class="aqi-section">
      <span class="sec-label">Air Quality</span>
      <div class="aqi-row">
        <div class="aqi-circle" style="color:${aqiInfo.color};border-color:${aqiInfo.color};">
          <span>${aqiData||'—'}</span>
        </div>
        <div class="aqi-details">
          <div class="aqi-label" style="color:${aqiInfo.color}">${aqiInfo.label}</div>
          <div class="aqi-desc">${aqiInfo.desc}</div>
          <div class="aqi-bar"><div class="aqi-fill" style="width:${aqiInfo.pct}%;background:${aqiInfo.color}"></div></div>
        </div>
      </div>
    </div>

    <div class="sec-div"></div>

    <!-- Pollen -->
    <div class="pollen-section">
      <span class="sec-label">Pollen Levels</span>
      <div class="pollen-grid">
        ${pollen.map(p=>`
        <div class="pollen-item">
          <div class="pollen-emoji">${p.emoji}</div>
          <div class="pollen-type">${p.type}</div>
          <div class="pollen-level ${p.cls}">${p.level}</div>
        </div>`).join('')}
      </div>
    </div>

    <div class="sec-div"></div>

    <!-- Metrics -->
    <div class="metrics-section">
      <div class="metric-box">
        <div class="metric-val" style="color:var(--accent)">${humidity}%</div>
        <div class="metric-lbl">Humidity</div>
        <div class="metric-bar"><div class="metric-fill" style="width:${humidity}%"></div></div>
      </div>
      <div class="metric-box">
        <div class="metric-val" style="color:${uvData.color}">${uvData.label}</div>
        <div class="metric-lbl">UV Index</div>
        <div class="metric-bar"><div class="metric-fill" style="width:${uvData.pct}%;background:${uvData.color}"></div></div>
      </div>
      <div class="metric-box">
        <div class="metric-val" style="color:#60a5fa">${Math.round(windKph)}</div>
        <div class="metric-lbl">km/h Wind</div>
        <div class="metric-bar"><div class="metric-fill" style="width:${Math.min(windKph/80*100,100)}%;background:#60a5fa"></div></div>
      </div>
    </div>

    <div class="sec-div"></div>

    <!-- Sun Arc -->
    <div class="sun-section">
      <span class="sec-label">Sun Position</span>
      <div class="sun-arc-wrap"><canvas id="sun-arc" style="width:100%;height:70px;display:block;"></canvas></div>
      <div class="sun-times">
        <span><i class="fa-solid fa-sunrise" style="color:#f97316;margin-right:5px;"></i>${sunriseStr}</span>
        <span><i class="fa-solid fa-sunset" style="color:#f97316;margin-right:5px;"></i>${sunsetStr}</span>
      </div>
    </div>

    <div class="sec-div"></div>

    <!-- Commute Advisor -->
    <div class="commute-section">
      <span class="sec-label">Commute Advisor</span>
      <div class="commute-grid">
        ${commute.map(c=>`
        <div class="commute-card ${c.recommended?'recommended':c.avoid?'avoid':''}">
          <div class="commute-icon">${c.icon}</div>
          <div class="commute-mode">${c.mode}</div>
          <div class="commute-rating">
            ${[1,2,3,4,5].map(n=>`<span style="color:${n<=c.rating?'var(--accent)':'rgba(255,255,255,0.15)'}">●</span>`).join('')}
          </div>
          <div class="commute-note">${c.note}</div>
        </div>`).join('')}
      </div>
    </div>

    <div class="sec-div"></div>

    <!-- Vibe + WFH -->
    <div class="vibe-wfh">
      <span id="vibe-badge"><i class="fa-solid ${vibe.icon}"></i>${vibe.label}</span>
      <span class="wfh-badge ${wfh.cls}"><i class="fa-solid ${wfh.icon}"></i>${wfh.label}</span>
    </div>

    <!-- Mood -->
    <div class="mood-section">
      <span id="mood-emoji">${mood.emoji}</span>
      <div id="mood-text">${mood.text.toUpperCase()}</div>
    </div>

    ${hourlyHTML ? `
    <div class="sec-div"></div>
    <div class="forecast-card">
      <span class="sec-label" style="padding:0 8px 12px;display:block;">Hourly Forecast</span>
      <div class="forecast-scroll">${hourlyHTML}</div>
    </div>` : ''}

    ${dailyHTML ? `
    <div class="sec-div"></div>
    <div class="daily-card">
      <span class="sec-label" style="margin-bottom:4px;">5-Day Forecast</span>
      ${dailyHTML}
    </div>` : ''}

    <div class="sec-div"></div>
    <div class="bottom-bar">
      <button id="report-btn" onclick="reportWeather()"><i class="fa-solid fa-satellite-dish"></i> Report Local Weather</button>
      <button id="share-btn" onclick="shareWeather()" title="Share"><i class="fa-solid fa-share-nodes"></i></button>
      <button id="share-btn" onclick="resetApiKey()" title="Reset API Key" style="font-size:12px;padding:13px 14px;"><i class="fa-solid fa-key"></i></button>
    </div>
    <div class="updated-row"><span class="live-dot"></span>Live · Updated ${now_str}</div>
  `;

  // Wire events
  document.getElementById('unit-toggle').addEventListener('change', function() {
    isFahrenheit = this.checked;
    if (weatherData) renderWeather(weatherData, forecastData);
  });
  document.getElementById('fav-btn').addEventListener('click', toggleFav);

  // Animate score ring
  setTimeout(() => {
    const path = document.getElementById('score-ring-path');
    const numEl = document.getElementById('score-num');
    if (path) {
      const r=36, circ=2*Math.PI*r;
      const target = circ - (wscore.score/100)*circ;
      path.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(0.23,1,0.32,1)';
      path.style.strokeDashoffset = target;
    }
    if (numEl) animateCounter(numEl, 0, wscore.score, 1200);
    const tempEl = document.getElementById('temp-num');
    if (tempEl) animateCounter(tempEl, 0, dispTemp, 700);
  }, 100);

  // Sun arc
  setTimeout(() => {
    const arc = document.getElementById('sun-arc');
    if (arc && sunrise && sunset) drawSunArc(arc, sunrise, sunset);
  }, 200);

  // ── POPULATE SIDE PANELS (desktop only) ───────────────────────────────
  populatePanels({
    aqiData, aqiInfo, pollen, commute, vibe, wfh, mood,
    hourlyHTML, dailyHTML, bestTime, bestBarHTML, wscore
  });

  startClock();
  renderFavStrip();
}

function populatePanels({aqiData, aqiInfo, pollen, commute, vibe, wfh, mood, hourlyHTML, dailyHTML, bestTime, bestBarHTML, wscore}) {
  // Only run if panels exist (desktop)
  const pLeft  = document.getElementById('panel-left');
  const pRight = document.getElementById('panel-right');
  if (!pLeft || !pRight) return;

  // ── LEFT PANEL ────────────────────────────────────────────────────────

  // Panel favs
  const pfav = document.getElementById('panel-fav-list');
  if (pfav) {
    if (favorites.length) {
      pfav.innerHTML = favorites.map(f =>
        `<div class="fav-chip" data-city="${f}" style="margin-bottom:6px;width:100%;justify-content:space-between;">
          <span><i class="fa-solid fa-star" style="color:#fbbf24;font-size:9px;margin-right:6px;"></i>${f}</span>
          <span class="rm" onclick="removeFav(event,'${f}')">✕</span>
        </div>`
      ).join('');
      pfav.querySelectorAll('.fav-chip').forEach(c => c.addEventListener('click', ()=>searchCity(c.dataset.city)));
    } else {
      pfav.innerHTML = `<div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-muted);text-align:center;padding:8px 0;">Star a city to save it here</div>`;
    }
  }

  // AQI panel
  const pAqi = document.getElementById('panel-aqi');
  if (pAqi) pAqi.innerHTML = `
    <span class="sec-label">Air Quality</span>
    <div class="aqi-row">
      <div class="aqi-circle" style="color:${aqiInfo.color};border-color:${aqiInfo.color};">
        <span>${aqiData||'—'}</span>
      </div>
      <div class="aqi-details">
        <div class="aqi-label" style="color:${aqiInfo.color}">${aqiInfo.label}</div>
        <div class="aqi-desc">${aqiInfo.desc}</div>
        <div class="aqi-bar"><div class="aqi-fill" style="width:${aqiInfo.pct}%;background:${aqiInfo.color}"></div></div>
      </div>
    </div>`;

  // Pollen panel
  const pPollen = document.getElementById('panel-pollen');
  if (pPollen) pPollen.innerHTML = `
    <span class="sec-label">Pollen Levels</span>
    <div class="pollen-grid">
      ${pollen.map(p=>`
      <div class="pollen-item">
        <div class="pollen-emoji">${p.emoji}</div>
        <div class="pollen-type">${p.type}</div>
        <div class="pollen-level ${p.cls}">${p.level}</div>
      </div>`).join('')}
    </div>`;

  // Commute panel
  const pCommute = document.getElementById('panel-commute');
  if (pCommute) pCommute.innerHTML = `
    <span class="sec-label">Commute Advisor</span>
    <div class="commute-grid">
      ${commute.map(c=>`
      <div class="commute-card ${c.recommended?'recommended':c.avoid?'avoid':''}">
        <div class="commute-icon">${c.icon}</div>
        <div class="commute-info">
          <div class="commute-mode">${c.mode}</div>
          <div class="commute-rating">
            ${[1,2,3,4,5].map(n=>`<span style="color:${n<=c.rating?'var(--accent)':'rgba(255,255,255,0.15)'}">●</span>`).join('')}
          </div>
          <div class="commute-note">${c.note}</div>
        </div>
      </div>`).join('')}
    </div>`;

  // ── RIGHT PANEL ───────────────────────────────────────────────────────

  // Vibe + Mood panel
  const pVibeMood = document.getElementById('panel-vibe-mood');
  if (pVibeMood) pVibeMood.innerHTML = `
    <span class="sec-label">Vibe & Mood</span>
    <div style="display:flex;gap:8px;align-items:stretch;margin-bottom:16px;">
      <span style="display:inline-flex;align-items:center;gap:7px;background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.25);border-radius:14px;padding:10px 14px;font-size:13px;font-weight:600;color:var(--accent);font-family:'DM Mono',monospace;flex:1;">
        <i class="fa-solid ${vibe.icon}" style="font-size:14px;"></i>${vibe.label}
      </span>
      <span class="wfh-badge ${wfh.cls}" style="flex:1;border-radius:14px;padding:10px 14px;font-size:13px;"><i class="fa-solid ${wfh.icon}"></i>${wfh.label}</span>
    </div>
    <div style="text-align:center;padding:12px 0 4px;">
      <span style="font-size:44px;display:block;animation:moodBob 3s ease-in-out infinite;line-height:1.2;">${mood.emoji}</span>
      <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-muted);margin-top:8px;letter-spacing:1px;">${mood.text.toUpperCase()}</div>
    </div>`;

  // Best time panel
  const pBestTime = document.getElementById('panel-besttime');
  if (pBestTime) {
    if (bestTime) {
      pBestTime.innerHTML = `
        <span class="sec-label">Best Time Outside</span>
        <div class="besttime-bar" style="height:48px;">${bestBarHTML}</div>
        <div class="bt-labels">
          ${bestTime.items.map(h=>{const hr=new Date(h.dt*1000).getHours();return`<span class="bt-label">${hr===0?'12a':hr<12?`${hr}a`:hr===12?'12p':`${hr-12}p`}</span>`;}).join('')}
        </div>
        <div class="besttime-badge" style="margin-top:10px;"><i class="fa-solid fa-clock-rotate-left"></i> ~${bestTime.time}</div>`;
    } else {
      pBestTime.innerHTML = `<span class="sec-label">Best Time Outside</span><div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-muted);padding:8px 0;">No forecast data available</div>`;
    }
  }

  // Hourly panel
  const pHourly = document.getElementById('panel-hourly');
  if (pHourly) pHourly.innerHTML = hourlyHTML
    ? `<span class="sec-label">Hourly Forecast</span>
       <div class="forecast-scroll" style="padding-bottom:6px;gap:7px;">
         ${hourlyHTML.replace(/flex: 0 0 72px/g,'flex:0 0 62px').replace(/font-size: 20px/g,'font-size:16px').replace(/font-size: 14px/g,'font-size:12px')}
       </div>`
    : `<span class="sec-label">Hourly Forecast</span><div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-muted);">No forecast data</div>`;

  // Daily panel — cleaner approach
  const pDaily = document.getElementById('panel-daily');
  if (pDaily) pDaily.innerHTML = dailyHTML
    ? `<span class="sec-label">5-Day Forecast</span>${dailyHTML}`
    : `<span class="sec-label">5-Day Forecast</span><div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-muted);">No forecast data</div>`;
}

// ── FAVORITES ──────────────────────────────────────────────────────────
function toggleFav() {
  const name = weatherData?.name; if (!name) return;
  const idx = favorites.indexOf(name);
  if (idx===-1) favorites.push(name); else favorites.splice(idx,1);
  localStorage.setItem('wos_favs', JSON.stringify(favorites));
  renderWeather(weatherData, forecastData);
}

function renderFavStrip() {
  const strip = document.getElementById('fav-strip');
  if (!favorites.length) { strip.innerHTML=''; }
  else {
    strip.innerHTML = favorites.map(f =>
      `<span class="fav-chip" data-city="${f}"><i class="fa-solid fa-star" style="color:#fbbf24;font-size:9px;"></i>${f}<span class="rm" onclick="removeFav(event,'${f}')">✕</span></span>`
    ).join('');
    strip.querySelectorAll('.fav-chip').forEach(c => c.addEventListener('click', ()=>searchCity(c.dataset.city)));
  }
  // Refresh panel fav list too
  const pfav = document.getElementById('panel-fav-list');
  if (pfav) {
    if (favorites.length) {
      pfav.innerHTML = favorites.map(f =>
        `<div class="fav-chip" data-city="${f}" style="margin-bottom:6px;width:100%;justify-content:space-between;">
          <span><i class="fa-solid fa-star" style="color:#fbbf24;font-size:9px;margin-right:6px;"></i>${f}</span>
          <span class="rm" onclick="removeFav(event,'${f}')">✕</span>
        </div>`
      ).join('');
      pfav.querySelectorAll('.fav-chip').forEach(c => c.addEventListener('click', ()=>searchCity(c.dataset.city)));
    } else {
      pfav.innerHTML = `<div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-muted);text-align:center;padding:8px 0;">Star a city to save it here</div>`;
    }
  }
}

function removeFav(e, city) {
  e.stopPropagation();
  favorites = favorites.filter(f=>f!==city);
  localStorage.setItem('wos_favs', JSON.stringify(favorites));
  renderFavStrip();
}

// ── SHARE / REPORT ─────────────────────────────────────────────────────
function shareWeather() {
  if (!weatherData) return;
  const tc=weatherData.main.temp;
  const disp=isFahrenheit?Math.round(tc*9/5+32)+'°F':Math.round(tc)+'°C';
  const wscore=getWeatherScore(tc,...[false,false,false,weatherData.wind.speed*3.6,weatherData.main.humidity,0]);
  const text=`🌡️ ${disp} in ${weatherData.name} — ${weatherData.weather[0].description}. Weather Score: ${wscore.score}/100. Checked via WeatherOS.`;
  if (navigator.share) navigator.share({title:'WeatherOS',text}).catch(()=>{});
  else navigator.clipboard.writeText(text).then(()=>alert('Copied to clipboard! ✅'));
}

function reportWeather() {
  const ok=confirm("📍 Does the weather shown match what you're experiencing right now?\n\nOK = Accurate · Cancel = Flag discrepancy");
  alert(ok?"✅ Thanks! Your report helps keep WeatherOS accurate.":"🚨 Discrepancy noted. We'll cross-check nearby stations. Thank you!");
}

function resetApiKey() {
  if (confirm('Reset your API key? You will be asked to enter a new one on reload.')) {
    localStorage.removeItem('wos_api_key');
    location.reload();
  }
}

// ── FETCH ──────────────────────────────────────────────────────────────
function showLoading(msg='Loading weather…') {
  document.getElementById('main-card').innerHTML=`
    <div class="loading-card">
      <span class="loading-icon"><i class="fa-solid fa-circle-notch"></i></span>
      <div class="loading-text">${msg}</div>
    </div>`;
}

function showError(msg) {
  document.getElementById('main-card').innerHTML=`
    <div class="error-card">
      <i class="fa-solid fa-triangle-exclamation error-icon"></i>
      <div style="font-weight:700;margin-bottom:8px;">Could not load weather</div>
      <div style="font-family:'DM Mono',monospace;font-size:12px;color:var(--text-muted)">${msg}</div>
    </div>`;
}

async function fetchWeather(lat, lon) {
  if (API_KEY==='YOUR_KEY_HERE') { showDemoData(lat,lon); return; }
  try {
    const [cur, fore, airQ] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`).then(r=>{if(!r.ok)throw new Error('API '+r.status);return r.json();}),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`).then(r=>r.ok?r.json():null).catch(()=>null),
      fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`).then(r=>r.ok?r.json():null).catch(()=>null),
    ]);
    const aqiValue = airQ?.list?.[0]?.main?.aqi || null;
    renderWeather(cur, fore, aqiValue);
  } catch(e) { showError(e.message); }
}

async function searchCity(name) {
  if (!name.trim()) return;
  showLoading('Searching…');
  if (API_KEY==='YOUR_KEY_HERE') {
    const demo={main:{temp:22,feels_like:21,humidity:55,pressure:1013},wind:{speed:3.5},weather:[{id:800,description:'clear sky'}],name,sys:{country:'?'},visibility:10000};
    renderWeather(demo,null,2);
    addDemoBanner(); return;
  }
  try {
    const geo=await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(name)}&limit=1&appid=${API_KEY}`).then(r=>r.json());
    if (!geo.length) { showError(`City "${name}" not found.`); return; }
    await fetchWeather(geo[0].lat, geo[0].lon);
  } catch(e) { showError(e.message); }
}

async function showDemoData(lat, lon) {
  const hour=new Date().getHours(), month=new Date().getMonth();
  const scenarios=[
    {main:{temp:34,feels_like:37,humidity:62,pressure:1008},wind:{speed:4.2},weather:[{id:800,description:'clear sky'}],sys:{sunrise:1700000000,sunset:1700043200,country:'--'},visibility:10000},
    {main:{temp:14,feels_like:11,humidity:82,pressure:1018},wind:{speed:7.5},weather:[{id:501,description:'moderate rain'}],sys:{sunrise:1700000000,sunset:1700043200,country:'--'},visibility:4000},
    {main:{temp:2,feels_like:-3,humidity:78,pressure:1022},wind:{speed:5},weather:[{id:601,description:'snow'}],sys:{sunrise:1700000000,sunset:1700043200,country:'--'},visibility:2000},
  ];
  const demo={...scenarios[Math.floor(hour/8)%3]};
  try {
    const geo=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`).then(r=>r.json());
    demo.name=geo.address?.city||geo.address?.town||geo.address?.village||'Your City';
    demo.sys.country=(geo.address?.country_code||'--').toUpperCase();
  } catch { demo.name='Your City'; demo.sys.country='--'; }
  renderWeather(demo, null, 2);
  addDemoBanner();
}

function addDemoBanner() {
  const wrap=document.getElementById('app');
  if (wrap.querySelector('.demo-banner')) return;
  const b=document.createElement('div');
  b.className='demo-banner';
  b.innerHTML='⚠ Demo mode — replace API_KEY for live data';
  wrap.appendChild(b);
}

// ── INIT ───────────────────────────────────────────────────────────────
document.getElementById('search-btn').addEventListener('click', ()=>{
  const v=document.getElementById('city-search').value.trim();
  if (v) searchCity(v);
});
document.getElementById('city-search').addEventListener('keydown', e=>{
  if (e.key==='Enter') { const v=e.target.value.trim(); if(v) searchCity(v); }
});
document.getElementById('location-btn').addEventListener('click', init);

function init() {
  showLoading('Detecting your location…');
  if (!navigator.geolocation) { showError('Geolocation not supported.'); return; }
  navigator.geolocation.getCurrentPosition(
    pos=>fetchWeather(pos.coords.latitude, pos.coords.longitude),
    ()=>fetch('https://ipapi.co/json/').then(r=>r.json()).then(d=>fetchWeather(d.latitude,d.longitude)).catch(()=>showError('Location access denied.')),
    {timeout:8000, maximumAge:300000}
  );
}

renderFavStrip();
init();

// ── PWA SERVICE WORKER ────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[WeatherOS] SW registered:', reg.scope))
      .catch(err => console.warn('[WeatherOS] SW failed:', err));
  });
}

// ── PWA INSTALL PROMPT ────────────────────────────────────────────────
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;

  // Show install banner after 3 seconds if not already installed
  setTimeout(() => {
    if (deferredInstallPrompt) showInstallBanner();
  }, 3000);
});

function showInstallBanner() {
  const existing = document.getElementById('install-banner');
  if (existing) return;

  const banner = document.createElement('div');
  banner.id = 'install-banner';
  banner.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: rgba(167,139,250,0.15); backdrop-filter: blur(20px);
    border: 1px solid rgba(167,139,250,0.4); border-radius: 20px;
    padding: 14px 20px; display: flex; align-items: center; gap: 14px;
    z-index: 9999; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    animation: slideUp 0.4s cubic-bezier(0.23,1,0.32,1);
    font-family: 'Syne', sans-serif; color: #f0f0f0; white-space: nowrap;
  `;
  banner.innerHTML = `
    <span style="font-size:22px;">📲</span>
    <div>
      <div style="font-size:13px;font-weight:700;">Install WeatherOS</div>
      <div style="font-size:11px;color:rgba(240,240,240,0.6);font-family:'DM Mono',monospace;">Add to home screen for the full app experience</div>
    </div>
    <button onclick="installPWA()" style="background:var(--accent);border:none;border-radius:12px;padding:9px 16px;color:#fff;font-family:'Syne',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">Install</button>
    <button onclick="document.getElementById('install-banner').remove()" style="background:none;border:none;color:rgba(240,240,240,0.5);font-size:18px;cursor:pointer;padding:4px;">✕</button>
  `;

  // Add slideUp keyframe if not present
  if (!document.getElementById('pwa-style')) {
    const style = document.createElement('style');
    style.id = 'pwa-style';
    style.textContent = '@keyframes slideUp { from { transform: translateX(-50%) translateY(80px); opacity:0; } to { transform: translateX(-50%) translateY(0); opacity:1; } }';
    document.head.appendChild(style);
  }

  document.body.appendChild(banner);
}

async function installPWA() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  console.log('[WeatherOS] Install outcome:', outcome);
  deferredInstallPrompt = null;
  const banner = document.getElementById('install-banner');
  if (banner) banner.remove();
}

// Hide banner if already installed
window.addEventListener('appinstalled', () => {
  const banner = document.getElementById('install-banner');
  if (banner) banner.remove();
  deferredInstallPrompt = null;
  console.log('[WeatherOS] App installed successfully!');
});