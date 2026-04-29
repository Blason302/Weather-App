let unit = 'C';
let lastData = null;
let pageHistory = ['page-home'];
let searchTimer = null;

// Favorites stored in localStorage
function loadFavs() {
  try { return JSON.parse(localStorage.getItem('skies_favs') || '[]'); }
  catch { return []; }
}
function saveFavs(arr) {
  localStorage.setItem('skies_favs', JSON.stringify(arr));
}

// ════════════
// WMO CODES
// ════════════
const WMO = {
  0:['☀️','Clear sky'],1:['🌤','Mainly clear'],2:['⛅','Partly cloudy'],3:['☁️','Overcast'],
  45:['🌫','Foggy'],48:['🌫','Icy fog'],51:['🌦','Light drizzle'],53:['🌦','Drizzle'],
  55:['🌧','Heavy drizzle'],61:['🌧','Light rain'],63:['🌧','Rain'],65:['🌧','Heavy rain'],
  71:['🌨','Light snow'],73:['❄️','Snow'],75:['❄️','Heavy snow'],77:['🌨','Snow grains'],
  80:['🌦','Light showers'],81:['🌧','Rain showers'],82:['⛈','Heavy showers'],
  85:['🌨','Snow showers'],86:['❄️','Heavy snow showers'],95:['⛈','Thunderstorm'],
  96:['⛈','Thunder + hail'],99:['⛈','Thunder + heavy hail']
};
const wmo = c => WMO[c] || ['🌡','Unknown'];

// ════════════
// HELPERS
// ════════════
const toF = c => Math.round(c * 9/5 + 32);
const dT  = c => unit === 'C' ? Math.round(c) + '°' : toF(c) + '°';
const windDir = d => ['N','NE','E','SE','S','SW','W','NW','N'][Math.round(d/45)];
const fmtTime = iso => new Date(iso).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
const dayLabel = (iso, i) => i === 0 ? 'Today' : new Date(iso).toLocaleDateString('en-US', {weekday:'short'});
const uvLabel = uv => uv<=2?'Low':uv<=5?'Moderate':uv<=7?'High':uv<=10?'Very High':'Extreme';
const esc = s => (s||'').replace(/'/g, "\\'");

function getTheme(code, isNight) {
  if (isNight) return 'var(--sky-night)';
  if ([0,1].includes(code)) return 'var(--sky-clear)';
  if ([2,3].includes(code)) return 'var(--sky-clouds)';
  if ([45,48].includes(code)) return 'var(--sky-fog)';
  if ([51,53,55,61,63,65,80,81,82].includes(code)) return 'var(--sky-rain)';
  if ([71,73,75,77,85,86].includes(code)) return 'var(--sky-snow)';
  if ([95,96,99].includes(code)) return 'var(--sky-storm)';
  return 'var(--sky-clear)';
}

// ════════════
// ROUTING
// ════════════
function goPage(id) {
  if (!lastData && id !== 'page-home') return;
  document.querySelector('.page.active').classList.remove('active');
  const next = document.getElementById(id);
  next.classList.add('active', 'page-enter');
  next.addEventListener('animationend', () => next.classList.remove('page-enter'), {once:true});
  pageHistory.push(id);
  window.scrollTo(0, 0);
  if (id === 'page-hourly') renderHourly();
  if (id === 'page-airquality') renderAQ();
  if (id === 'page-weekly') renderWeekly();
  if (id === 'page-insights') renderInsights();
}

function goBack() {
  pageHistory.pop();
  const prev = pageHistory[pageHistory.length-1] || 'page-home';
  document.querySelector('.page.active').classList.remove('active');
  document.getElementById(prev).classList.add('active');
  window.scrollTo(0, 0);
}

// ════════════
// STATES
// ════════════
function setState(s) {
  ['idle','loading','error'].forEach(id => document.getElementById('state-'+id).classList.remove('show'));
  document.getElementById('weather-content').classList.remove('show');
  if (s === 'weather') document.getElementById('weather-content').classList.add('show');
  else if (s) document.getElementById('state-'+s).classList.add('show');
}

// ════════════
// RENDER HOME
// ════════════
function renderWeather(d) {
  lastData = d;
  const cur = d.current, daily = d.daily, hourly = d.hourly;
  const now = new Date();
  const srMs = new Date(daily.sunrise[0]).getTime();
  const ssMs = new Date(daily.sunset[0]).getTime();
  const isNight = now < srMs || now > ssMs;
  document.body.style.setProperty('--bg', getTheme(cur.weather_code, isNight));

  const [icon, label] = wmo(cur.weather_code);

  // Sidebar weather
  document.getElementById('sw-city').textContent = d.cityName + (d.country ? ', ' + d.country : '');
  document.getElementById('sw-temp').textContent = dT(cur.temperature_2m);
  document.getElementById('sw-icon').textContent = icon;
  document.getElementById('sw-condition').textContent = label;
  document.getElementById('sw-feels').textContent = 'Feels like ' + dT(cur.apparent_temperature);
  document.getElementById('sidebar-weather').classList.add('show');

  // Update fav button state
  updateFavBtn();

  // Stats
  const hum = cur.relative_humidity_2m;
  document.getElementById('humidity').textContent = hum + '%';
  document.getElementById('hum-bar').style.width = hum + '%';
  document.getElementById('wind-speed').textContent = Math.round(cur.wind_speed_10m) + ' km/h';
  document.getElementById('wind-dir').textContent = windDir(cur.wind_direction_10m) + ' wind';
  const prec = cur.precipitation || 0;
  document.getElementById('precip').textContent = prec.toFixed(1) + ' mm';
  const prob = hourly ? hourly.precipitation_probability[0] : null;
  document.getElementById('precip-prob').textContent = prob != null ? prob + '% chance' : '';
  document.getElementById('visibility').textContent = cur.visibility != null ? (cur.visibility/1000).toFixed(1) + ' km' : '—';
  const uv = daily.uv_index_max ? daily.uv_index_max[0] : null;
  document.getElementById('uv-index').textContent = uv != null ? 'UV ' + uv + ' · ' + uvLabel(uv) : '';

  // Sun
  const sr = new Date(daily.sunrise[0]), ss = new Date(daily.sunset[0]);
  const diff = ss - sr, hrs = Math.floor(diff/3600000), mins = Math.floor((diff%3600000)/60000);
  document.getElementById('sunrise').textContent = fmtTime(daily.sunrise[0]);
  document.getElementById('sunset').textContent = fmtTime(daily.sunset[0]);
  document.getElementById('day-length').textContent = hrs + 'h ' + mins + 'm';

  // Forecast
  const fl = document.getElementById('forecast-list'); fl.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const [fi, fd] = wmo(daily.weather_code[i]);
    const row = document.createElement('div'); row.className = 'forecast-row';
    row.innerHTML = `<div class="f-day">${dayLabel(daily.time[i],i)}</div><div class="f-icon">${fi}</div><div class="f-desc">${fd}</div><div class="f-temps"><span>${dT(daily.temperature_2m_max[i])}</span><span class="f-lo">${dT(daily.temperature_2m_min[i])}</span></div>`;
    fl.appendChild(row);
  }
  document.getElementById('updated-line').textContent = 'Updated ' + new Date(cur.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

  // Navigate to home page
  if (!document.getElementById('page-home').classList.contains('active')) {
    document.querySelector('.page.active').classList.remove('active');
    document.getElementById('page-home').classList.add('active');
    pageHistory = ['page-home'];
  }
  setState('weather');

  // Update fav temps in list
  renderFavList();
}

// ════════════
// FAVORITES
// ════════════
function isFaved() {
  if (!lastData) return false;
  const favs = loadFavs();
  return favs.some(f => f.lat === lastData.lat && f.lon === lastData.lon);
}

function updateFavBtn() {
  const btn = document.getElementById('fav-toggle-btn');
  const icon = document.getElementById('fav-btn-icon');
  const text = document.getElementById('fav-btn-text');
  if (isFaved()) {
    btn.classList.add('saved');
    icon.textContent = '★';
    text.textContent = 'Saved to Favorites';
  } else {
    btn.classList.remove('saved');
    icon.textContent = '＋';
    text.textContent = 'Save to Favorites';
  }
}

function toggleFavorite() {
  if (!lastData) return;
  let favs = loadFavs();
  const idx = favs.findIndex(f => f.lat === lastData.lat && f.lon === lastData.lon);
  if (idx === -1) {
    const cur = lastData.current, daily = lastData.daily;
    const [icon] = wmo(cur.weather_code);
    favs.push({
      name: lastData.cityName,
      country: lastData.country || '',
      lat: lastData.lat,
      lon: lastData.lon,
      icon: icon,
      temp: Math.round(cur.temperature_2m),
      tempF: toF(cur.temperature_2m)
    });
  } else {
    favs.splice(idx, 1);
  }
  saveFavs(favs);
  updateFavBtn();
  renderFavList();
}

function renderFavList() {
  const favs = loadFavs();
  const list = document.getElementById('fav-list');
  const empty = document.getElementById('fav-empty');
  document.getElementById('fav-count').textContent = favs.length;

  // Remove existing fav items (keep empty message)
  list.querySelectorAll('.fav-item').forEach(el => el.remove());

  if (favs.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  favs.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'fav-item';
    const displayTemp = unit === 'C' ? f.temp + '°' : f.tempF + '°';
    item.innerHTML = `
      <div class="fav-icon">${f.icon}</div>
      <div class="fav-info">
        <div class="fav-city">${f.name}</div>
        <div class="fav-country">${f.country}</div>
      </div>
      <div class="fav-temp">${displayTemp}</div>
      <button class="fav-remove" onclick="removeFav(${i},event)" title="Remove">×</button>`;
    item.addEventListener('click', () => fetchWeather(f.lat, f.lon, f.name, f.country));
    list.appendChild(item);
  });
}

function removeFav(idx, e) {
  e.stopPropagation();
  const favs = loadFavs();
  favs.splice(idx, 1);
  saveFavs(favs);
  updateFavBtn();
  renderFavList();
}

// ════════════
// HOURLY
// ════════════
function renderHourly() {
  if (!lastData) return;
  const h = lastData.hourly, now = new Date();
  let si = 0;
  for (let i = 0; i < h.time.length; i++) {
    if (new Date(h.time[i]).getHours() === now.getHours() && new Date(h.time[i]).getDate() === now.getDate()) { si = i; break; }
  }
  const times = h.time.slice(si, si+24);
  const temps = h.temperature_2m.slice(si, si+24);
  const codes = h.weather_code.slice(si, si+24);
  const rain  = h.precipitation_probability.slice(si, si+24);
  const winds = h.wind_speed_10m.slice(si, si+24);

  // Cards
  const track = document.getElementById('hourly-track'); track.innerHTML = '';
  times.forEach((t, i) => {
    const card = document.createElement('div');
    card.className = 'h-card' + (i === 0 ? ' now' : '');
    card.innerHTML = `<div class="h-time">${i===0?'Now':fmtTime(t)}</div><div class="h-icon">${wmo(codes[i])[0]}</div><div class="h-temp">${dT(temps[i])}</div><div class="h-rain">${rain[i]}%</div>`;
    track.appendChild(card);
  });

  // SVG curve
  const svg = document.getElementById('temp-svg');
  const W = 460, H = 90, PAD = 22;
  const minT = Math.min(...temps), maxT = Math.max(...temps), rng = maxT - minT || 1;
  const pts = temps.map((t, i) => [PAD + (i/(temps.length-1))*(W-PAD*2), PAD + (1-(t-minT)/rng)*(H-PAD*2)]);
  let path = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i-1], [cx, cy] = pts[i], mx = (px+cx)/2;
    path += ` C${mx},${py} ${mx},${cy} ${cx},${cy}`;
  }
  svg.innerHTML = `
    <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.28)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.02)"/>
    </linearGradient></defs>
    <path d="${path} L${pts[pts.length-1][0]},${H} L${pts[0][0]},${H} Z" fill="url(#tg)"/>
    <path d="${path}" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2.5" stroke-linecap="round"/>
    ${temps.filter((_,i) => i%4===0).map((_,ii) => {
      const i = ii*4;
      return `<text x="${pts[i][0]}" y="${pts[i][1]-8}" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="10" font-family="Outfit,sans-serif">${dT(temps[i])}</text>`;
    }).join('')}`;

  // Detail list
  const det = document.getElementById('hourly-detail'); det.innerHTML = '';
  times.forEach((t, i) => {
    const row = document.createElement('div'); row.className = 'h-detail-row';
    row.innerHTML = `
      <div class="hd-time">${i===0?'Now':fmtTime(t)}</div>
      <div class="hd-ico">${wmo(codes[i])[0]}</div>
      <div class="hd-info"><div class="hd-temp">${dT(temps[i])}</div><div class="hd-meta">💨 ${Math.round(winds[i])} km/h · ${wmo(codes[i])[1]}</div></div>
      <div><div style="font-size:12px;color:rgba(150,210,255,.9);text-align:right;margin-bottom:3px">${rain[i]}%</div><div class="hd-rb-wrap"><div class="hd-rb" style="width:${Math.max(4,rain[i])}%"></div></div></div>`;
    det.appendChild(row);
  });
}

// ════════════
// AIR QUALITY
// ════════════
async function renderAQ() {
  if (!lastData) return;
  const { lat, lon } = lastData;
  try {
    const r = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone&timezone=auto`);
    const aq = await r.json();
    const cur = aq.current;
    const aqi = Math.round(cur.european_aqi || 0);
    const circ = 390;
    document.getElementById('aqi-ring').style.strokeDashoffset = circ - Math.min(aqi/300, 1) * circ;
    document.getElementById('aqi-ring').style.stroke = aqiColor(aqi);
    document.getElementById('aqi-number').textContent = aqi;
    const [cat, advice, tips] = aqiInfo(aqi);
    document.getElementById('aqi-category').textContent = cat;
    document.getElementById('aqi-advice').textContent = advice;
    const polls = [
      {name:'PM2.5', val:cur.pm2_5, unit:'µg/m³', max:150, color:'rgba(100,180,255,.8)'},
      {name:'PM10',  val:cur.pm10,  unit:'µg/m³', max:200, color:'rgba(120,220,160,.8)'},
      {name:'NO₂',   val:cur.nitrogen_dioxide, unit:'µg/m³', max:200, color:'rgba(255,180,80,.8)'},
      {name:'O₃',    val:cur.ozone, unit:'µg/m³', max:180, color:'rgba(180,130,255,.8)'},
    ];
    const pg = document.getElementById('pollutant-grid'); pg.innerHTML = '';
    polls.forEach(p => {
      const v = (p.val||0), pct = Math.min(v/p.max*100, 100).toFixed(0);
      const d = document.createElement('div'); d.className = 'poll-card';
      d.innerHTML = `<div class="poll-name">${p.name}</div><div class="poll-val">${v.toFixed(1)}<span class="poll-unit">${p.unit}</span></div><div class="poll-bar-bg"><div class="poll-bar" style="width:${pct}%;background:${p.color}"></div></div>`;
      pg.appendChild(d);
    });
    const ht = document.getElementById('health-tips'); ht.innerHTML = '';
    tips.forEach(t => {
      const d = document.createElement('div'); d.className = 'health-tip';
      d.innerHTML = `<div class="h-dot" style="background:${aqiColor(aqi)}"></div><span>${t}</span>`;
      ht.appendChild(d);
    });
  } catch {
    document.getElementById('aqi-number').textContent = '—';
    document.getElementById('aqi-category').textContent = 'Unavailable';
    document.getElementById('aqi-advice').textContent = 'Air quality data could not be loaded for this location.';
  }
}

function aqiColor(aqi) {
  if (aqi<=50)  return 'rgba(80,220,100,.9)';
  if (aqi<=100) return 'rgba(255,220,50,.9)';
  if (aqi<=150) return 'rgba(255,140,50,.9)';
  if (aqi<=200) return 'rgba(220,60,60,.9)';
  if (aqi<=300) return 'rgba(160,50,160,.9)';
  return 'rgba(140,30,30,.9)';
}

function aqiInfo(aqi) {
  if (aqi<=50)  return ['Good 😊','Air quality is satisfactory with little or no risk.',['Enjoy outdoor activities freely.','Great day for exercise outside.','Open your windows and let fresh air in!']];
  if (aqi<=100) return ['Moderate 😐','Acceptable air quality; some pollutants may affect sensitive individuals.',['Sensitive individuals should limit prolonged outdoor exertion.','Keep windows closed if you have allergies.','Stay hydrated and monitor for symptoms.']];
  if (aqi<=150) return ['Unhealthy for Sensitive Groups ⚠️','Children, elderly, and those with respiratory conditions may experience effects.',['Limit outdoor activity for children and elderly.','Wear a mask for extended outdoor exposure.','Run indoor air purifiers if available.']];
  if (aqi<=200) return ['Unhealthy 😷','Everyone may begin to experience health effects.',['Avoid prolonged outdoor exertion.','Wear an N95 mask outdoors.','Keep windows closed and use an air purifier.']];
  if (aqi<=300) return ['Very Unhealthy 🚨','Serious health effects expected for everyone.',['Stay indoors as much as possible.','Wear a respirator if you must go outside.','Avoid all outdoor exercise.']];
  return ['Hazardous ☠️','Emergency health warning — everyone is affected.',['Stay indoors with all windows shut.','Run air purifier at maximum setting.','Seek medical attention if breathing is difficult.']];
}

// ════════════
// WEEKLY
// ════════════
function renderWeekly() {
  if (!lastData) return;
  const d = lastData.daily;
  const list = document.getElementById('weekly-list'); list.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const [icon, desc] = wmo(d.weather_code[i]);
    const prec = d.precipitation_sum ? d.precipitation_sum[i]||0 : 0;
    const precProb = d.precipitation_probability_max ? d.precipitation_probability_max[i] : null;
    const uv   = d.uv_index_max ? d.uv_index_max[i] : null;
    const wind = d.wind_speed_10m_max ? d.wind_speed_10m_max[i] : null;
    const gusts = d.wind_gusts_10m_max ? d.wind_gusts_10m_max[i] : null;
    const sr = d.sunrise[i], ss = d.sunset[i];
    const diff = new Date(ss) - new Date(sr);
    const dlH = Math.floor(diff/3600000), dlM = Math.floor((diff%3600000)/60000);
    const card = document.createElement('div'); card.className = 'wk-card glass';
    card.innerHTML = `
      <div class="wk-hdr" onclick="toggleDay(this)">
        <div class="wk-day">${dayLabel(d.time[i],i)}</div>
        <div class="wk-ico">${icon}</div>
        <div class="wk-desc">${desc}</div>
        <div class="wk-temps"><span>${dT(d.temperature_2m_max[i])}</span><span class="wk-lo">${dT(d.temperature_2m_min[i])}</span></div>
        <div class="wk-arrow">›</div>
      </div>
      <div class="wk-body">
        <div class="wd-grid">
          <div class="wd-item"><div class="wd-label">Precipitation</div><div class="wd-val">${prec.toFixed(1)} mm</div>${precProb!=null?`<div class="pcp-bar"><div class="pcp-fill" style="width:${precProb}%"></div></div><div class="wd-sub">${precProb}% chance</div>`:''}</div>
          <div class="wd-item"><div class="wd-label">UV Index</div><div class="wd-val">${uv!=null?uv:'—'}</div><div class="wd-sub">${uv!=null?uvLabel(uv):''}</div></div>
          <div class="wd-item"><div class="wd-label">Max Wind</div><div class="wd-val">${wind?Math.round(wind)+' km/h':'—'}</div><div class="wd-sub">${gusts?'Gusts '+Math.round(gusts)+' km/h':''}</div></div>
          <div class="wd-item"><div class="wd-label">Day Length</div><div class="wd-val">${dlH}h ${dlM}m</div><div class="wd-sub">Daylight</div></div>
        </div>
        <div class="sun-row">
          <div class="sun-col"><div class="sc-label">🌅 Sunrise</div><div class="sc-val">${fmtTime(sr)}</div></div>
          <div class="sun-col"><div class="sc-label">🌇 Sunset</div><div class="sc-val">${fmtTime(ss)}</div></div>
          <div class="sun-col"><div class="sc-label">🌡 High</div><div class="sc-val">${dT(d.temperature_2m_max[i])}</div></div>
          <div class="sun-col"><div class="sc-label">❄️ Low</div><div class="sc-val">${dT(d.temperature_2m_min[i])}</div></div>
        </div>
      </div>`;
    list.appendChild(card);
  }
}

function toggleDay(hdr) {
  hdr.nextElementSibling.classList.toggle('open');
  hdr.querySelector('.wk-arrow').classList.toggle('open');
}

// ════════════
// INSIGHTS
// ════════════
function renderInsights() {
  if (!lastData) return;
  const cur = lastData.current, daily = lastData.daily;
  const maxT = daily.temperature_2m_max[0], minT = daily.temperature_2m_min[0];
  const totalRain = daily.precipitation_sum ? daily.precipitation_sum[0]||0 : 0;
  const uv = daily.uv_index_max ? daily.uv_index_max[0] : null;
  const today = document.getElementById('insights-today');
  today.innerHTML = `
    <div class="stat-item"><div class="stat-label">Today's Range</div><div class="stat-value">${Math.abs(maxT-minT).toFixed(1)}°</div><div class="stat-sub">${dT(minT)} → ${dT(maxT)}</div></div>
    <div class="stat-item"><div class="stat-label">Rain Today</div><div class="stat-value">${totalRain.toFixed(1)} mm</div><div class="stat-sub">Expected total</div></div>
    <div class="stat-item"><div class="stat-label">UV Index</div><div class="stat-value">${uv||'—'}</div><div class="stat-sub">${uv?uvLabel(uv):''}</div></div>
    <div class="stat-item"><div class="stat-label">Humidity</div><div class="stat-value">${cur.relative_humidity_2m}%</div><div class="stat-sub">${cur.relative_humidity_2m<40?'Dry':cur.relative_humidity_2m>70?'Humid':'Comfortable'}</div></div>`;
  const allMax = daily.temperature_2m_max, allMin = daily.temperature_2m_min;
  const weekMax = Math.max(...allMax), weekMin = Math.min(...allMin);
  const totalRainW = (daily.precipitation_sum||[]).reduce((a,b) => a+(b||0), 0);
  const rainyDays = (daily.precipitation_sum||[]).filter(v => (v||0)>0.5).length;
  const avgTemp = ((allMax.reduce((a,b)=>a+b,0)/7 + allMin.reduce((a,b)=>a+b,0)/7)/2).toFixed(1);
  document.getElementById('weekly-stats').innerHTML = `
    <div class="ins-row"><span>Hottest day</span><strong>${dT(weekMax)}</strong></div>
    <div class="ins-row"><span>Coldest day</span><strong>${dT(weekMin)}</strong></div>
    <div class="ins-row"><span>Average temperature</span><strong>${dT(parseFloat(avgTemp))}</strong></div>
    <div class="ins-row"><span>Total rainfall</span><strong>${totalRainW.toFixed(1)} mm</strong></div>
    <div class="ins-row"><span>Rainy days</span><strong>${rainyDays} of 7</strong></div>`;
  const facts = getWeatherFacts(cur.weather_code, cur.temperature_2m, cur.relative_humidity_2m, cur.wind_speed_10m);
  document.getElementById('fun-facts').innerHTML = facts.map(f => `<div class="fact-item"><span>${f.icon}</span><span>${f.text}</span></div>`).join('');
}

function getWeatherFacts(code, temp, hum, wind) {
  const facts = [];
  if (temp>35) facts.push({icon:'🌡',text:'At '+Math.round(temp)+'°C, heat stroke risk rises significantly. Stay hydrated and avoid peak sun hours (10am–4pm).'});
  else if (temp<0) facts.push({icon:'❄️',text:'Sub-zero temperatures can freeze exposed skin in under 30 minutes in windy conditions. Cover up!'});
  else if (temp>25) facts.push({icon:'☀️',text:'Temperatures around 25–30°C sit in the global "comfort zone" for most people worldwide.'});
  if (hum>80) facts.push({icon:'💧',text:'High humidity ('+hum+'%) slows sweat evaporation, trapping body heat and making it feel hotter than it is.'});
  else if (hum<30) facts.push({icon:'🏜️',text:'Low humidity ('+hum+'%) dries out skin and airways. A humidifier indoors can help significantly.'});
  if (wind>50) facts.push({icon:'💨',text:'At '+Math.round(wind)+' km/h, wind can move large branches and make walking difficult.'});
  else if (wind>30) facts.push({icon:'🌬️',text:'Wind at '+Math.round(wind)+' km/h creates a notable wind chill effect, making the air feel several degrees cooler.'});
  if ([95,96,99].includes(code)) facts.push({icon:'⛈',text:'Lightning strikes Earth about 100 times per second globally. Always stay indoors during thunderstorms.'});
  if ([71,73,75].includes(code)) facts.push({icon:'❄️',text:'No two snowflakes are identical — each forms a unique crystal based on the exact temperature and humidity it travels through.'});
  if ([0,1].includes(code)) facts.push({icon:'🌞',text:'Sunny days trigger serotonin production in the brain, boosting mood, focus, and energy levels throughout the day.'});
  if (facts.length < 3) facts.push({icon:'🌍',text:"Weather is the current state of the atmosphere. Climate is the 30-year average — that's why single weather events don't disprove climate trends."});
  if (facts.length < 3) facts.push({icon:'📡',text:'Modern 24-hour forecasts are accurate to within ~1°C, powered by satellite data and supercomputers running millions of calculations per second.'});
  return facts.slice(0, 4);
}

// ════════════
// DATA FETCH
// ════════════
async function fetchWeather(lat, lon, name, country) {
  setState('loading');
  try {
    const params = new URLSearchParams({
      latitude: lat, longitude: lon,
      current: ['temperature_2m','apparent_temperature','relative_humidity_2m','weather_code','wind_speed_10m','wind_direction_10m','precipitation','visibility'].join(','),
      hourly: ['temperature_2m','weather_code','precipitation_probability','wind_speed_10m'].join(','),
      daily: ['weather_code','temperature_2m_max','temperature_2m_min','sunrise','sunset','uv_index_max','precipitation_sum','precipitation_probability_max','wind_speed_10m_max','wind_gusts_10m_max'].join(','),
      forecast_days: 7, timezone: 'auto'
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    data.cityName = name; data.country = country; data.lat = lat; data.lon = lon;
    renderWeather(data);
  } catch {
    document.getElementById('error-msg').textContent = 'Could not load weather. Please try again.';
    setState('error');
  }
}

async function searchCities(q) {
  if (!q.trim()) { closeSug(); return; }
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`);
    const data = await r.json();
    showSug(data.results || []);
  } catch { closeSug(); }
}

function showSug(results) {
  const box = document.getElementById('suggestions');
  if (!results.length) { closeSug(); return; }
  box.innerHTML = results.map(r => `<div class="sug-item" onclick="selCity(${r.latitude},${r.longitude},'${esc(r.name)}','${esc(r.country_code||'')}')"><span class="sug-name">${r.name}${r.admin1?', '+r.admin1:''}</span><span class="sug-country">${r.country||''}</span></div>`).join('');
  box.classList.add('show');
}

const closeSug = () => document.getElementById('suggestions').classList.remove('show');

function selCity(lat, lon, name, country) {
  document.getElementById('search-input').value = name;
  closeSug();
  fetchWeather(lat, lon, name, country);
}

function switchUnit(u) {
  unit = u;
  document.getElementById('btn-c').classList.toggle('active', u === 'C');
  document.getElementById('btn-f').classList.toggle('active', u === 'F');
  if (lastData) renderWeather(lastData);
  renderFavList(); // update fav temps
}

async function locateMe() {
  if (!navigator.geolocation) { alert('Geolocation not supported.'); return; }
  setState('loading');
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
      const data = await r.json();
      const city = data.address.city || data.address.town || data.address.village || 'My Location';
      const cc = (data.address.country_code || '').toUpperCase();
      document.getElementById('search-input').value = city;
      fetchWeather(lat, lon, city, cc);
    } catch { fetchWeather(lat, lon, 'My Location', ''); }
  }, () => {
    document.getElementById('error-msg').textContent = 'Location access denied.';
    setState('error');
  });
}

// ════════════
// EVENTS
// ════════════
document.getElementById('search-input').addEventListener('input', e => {
  clearTimeout(searchTimer);
  const q = e.target.value;
  if (q.length < 2) { closeSug(); return; }
  searchTimer = setTimeout(() => searchCities(q), 350);
});
document.getElementById('search-input').addEventListener('keydown', e => { if (e.key === 'Escape') closeSug(); });
document.addEventListener('click', e => { if (!e.target.closest('.s-search-wrap')) closeSug(); });

// Init: render favorites from storage
renderFavList();