'use client'
import { useEffect, useRef } from 'react'

export default function NASAClock() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf: number
    const T0 = performance.now()

    const setSize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    setSize()
    window.addEventListener('resize', setSize)

    // ─────────────────────────────────────────────────
    // PRE-BAKE BACKGROUND — pure black space like file:130
    // ─────────────────────────────────────────────────
    const bgCv = document.createElement('canvas')
    bgCv.width = 1920; bgCv.height = 1080
    const bg = bgCv.getContext('2d')!

    // Pure deep black — exactly matching file:130 vibe
    bg.fillStyle = '#000005'
    bg.fillRect(0, 0, 1920, 1080)

    // Extremely subtle vignette — edges slightly darker
    const vig = bg.createRadialGradient(960,540,200,960,540,900)
    vig.addColorStop(0,   'rgba(0,0,0,0)')
    vig.addColorStop(0.7, 'rgba(0,0,0,0.05)')
    vig.addColorStop(1,   'rgba(0,0,0,0.35)')
    bg.fillStyle = vig
    bg.fillRect(0, 0, 1920, 1080)

    // Very faint central blue-violet nebula (barely visible)
    const neb1 = bg.createRadialGradient(600,480,0,600,480,420)
    neb1.addColorStop(0,   'rgba(28,18,85,0.10)')
    neb1.addColorStop(0.5, 'rgba(20,12,60,0.04)')
    neb1.addColorStop(1,   'rgba(0,0,0,0)')
    bg.fillStyle = neb1; bg.fillRect(0,0,1920,1080)

    const neb2 = bg.createRadialGradient(1300,650,0,1300,650,380)
    neb2.addColorStop(0,   'rgba(10,30,80,0.08)')
    neb2.addColorStop(1,   'rgba(0,0,0,0)')
    bg.fillStyle = neb2; bg.fillRect(0,0,1920,1080)

    // Stars — white dominant, minimal colour, clean on pure black
    for (let i = 0; i < 3400; i++) {
      const x = Math.random()*1920, y = Math.random()*1080
      const tier = i < 2300 ? 0 : i < 3100 ? 1 : 2
      const r  = tier===0 ? Math.random()*0.40+0.06
               : tier===1 ? Math.random()*0.70+0.30
               :             Math.random()*1.20+0.90
      const a  = tier===0 ? Math.random()*0.32+0.06
               : tier===1 ? Math.random()*0.50+0.20
               :             Math.random()*0.38+0.55
      const cols=['#ffffff','#ffffff','#ffffff','#ddeeff','#eef4ff','#fff8ee']
      bg.globalAlpha = a
      bg.fillStyle = cols[Math.floor(Math.random()*cols.length)]
      bg.beginPath(); bg.arc(x,y,r,0,Math.PI*2); bg.fill()
      // Cross flare on brightest stars
      if (tier===2 && a > 0.72) {
        const fl = r*5
        bg.globalAlpha = a*0.12
        bg.strokeStyle = '#ffffff'; bg.lineWidth = 0.5
        bg.beginPath()
        bg.moveTo(x-fl,y); bg.lineTo(x+fl,y)
        bg.moveTo(x,y-fl); bg.lineTo(x,y+fl)
        bg.stroke()
      }
    }
    bg.globalAlpha = 1

    // Twinkling animated stars
    interface TwStar { x:number;y:number;r:number;speed:number;phase:number }
    const twStars: TwStar[] = Array.from({length:450}, () => ({
      x:Math.random(), y:Math.random(),
      r:Math.random()*0.9+0.3,
      speed:Math.random()*2.0+0.5,
      phase:Math.random()*Math.PI*2,
    }))

    // Shooting stars
    interface Shooter {x:number;y:number;vx:number;vy:number;len:number;alpha:number;active:boolean;timer:number}
    const shooters: Shooter[] = Array.from({length:4}, () => ({
      x:0,y:0,vx:0,vy:0,len:0,alpha:0,active:false,
      timer:Math.random()*300+150,
    }))

    // Cosmic solar wind particles
    interface CosmicParticle {
      angle: number;
      dist: number;
      speed: number;
      size: number;
      alpha: number;
    }
    const cosmicParticles: CosmicParticle[] = Array.from({ length: 90 }, () => ({
      angle: Math.random() * Math.PI * 2,
      dist: Math.random() * 400 + 10,
      speed: Math.random() * 20 + 10,
      size: Math.random() * 0.8 + 0.3,
      alpha: Math.random() * 0.5 + 0.1,
    }));

    // Mouse Parallax coordinates
    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, tx: window.innerWidth / 2, ty: window.innerHeight / 2 };
    const handleMouseMove = (e: MouseEvent) => {
      mouse.tx = e.clientX;
      mouse.ty = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // ─────────────────────────────────────────────────
    // ARC TRAIL — soft glowing cloud arc (like file:130)
    // Draws a luminous arc BEHIND the planet along its orbit
    // ─────────────────────────────────────────────────
    const drawArcTrail = (
      cx: number, cy: number,   // orbit center
      r: number,                // orbit radius
      angle: number,            // current planet angle
      arcDeg: number,           // how many degrees of trail
      cr: number, cg: number, cb: number  // colour
    ) => {
      const arcRad = (arcDeg * Math.PI) / 180
      const startA = angle - arcRad
      const endA   = angle

      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      
      // Use a linear gradient along the chord of the arc to create a seamless fade
      const grad = ctx.createLinearGradient(
        cx + r*Math.cos(startA), cy + r*Math.sin(startA),
        cx + r*Math.cos(endA), cy + r*Math.sin(endA)
      )
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},0)`)
      grad.addColorStop(0.4, `rgba(${cr},${cg},${cb},0.15)`)
      grad.addColorStop(0.8, `rgba(${cr},${cg},${cb},0.6)`)
      grad.addColorStop(1, `rgba(255,255,255,0.8)`)

      // Stacked strokes with shadowBlur create a perfectly smooth, volumetric wake
      const layers = [
        { width: 12, blur: 20 },
        { width: 5, blur: 8 },
        { width: 1.5,  blur: 2 }
      ]
      
      layers.forEach(layer => {
        ctx.beginPath()
        ctx.arc(cx, cy, r, startA, endA)
        ctx.strokeStyle = grad
        ctx.lineWidth = layer.width
        ctx.shadowColor = `rgba(${cr},${cg},${cb},0.8)`
        ctx.shadowBlur = layer.blur
        ctx.lineCap = 'round'
        ctx.stroke()
      })
      
      ctx.restore()
    }

    // Planet sphere with sun-relative dynamic 3D lighting shading
    const drawSphere = (
      px:number, py:number, rad:number,
      cx:number, cy:number,
      h:string, m:string, b:string, s:string, limb:string, glowColor:string
    ) => {
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;

      // Illuminated point centers on the side facing the Sun
      const gx = px - rad * 0.35 * ux;
      const gy = py - rad * 0.35 * uy;

      // Atmospheric outer glow (expanded for rich depth)
      const atmo = ctx.createRadialGradient(px,py,rad*0.8,px,py,rad*2.4)
      atmo.addColorStop(0, glowColor)
      atmo.addColorStop(0.5, glowColor.replace(/[\d\.]+\)$/, '0.12)'))
      atmo.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.beginPath();ctx.arc(px,py,rad*2.4,0,Math.PI*2);ctx.fillStyle=atmo;ctx.fill()

      // Core planet body gradient
      const g = ctx.createRadialGradient(gx, gy, 0, px, py, rad)
      g.addColorStop(0, h)
      g.addColorStop(0.28, m)
      g.addColorStop(0.68, b)
      g.addColorStop(1, s)
      ctx.beginPath();ctx.arc(px,py,rad,0,Math.PI*2);ctx.fillStyle=g;ctx.fill()
      
      // Specular highlight — aligned dynamically to the Sun's light
      const sp = ctx.createRadialGradient(gx, gy, 0, px - rad * 0.15 * ux, py - rad * 0.15 * uy, rad * 0.65)
      sp.addColorStop(0, 'rgba(255,255,255,0.48)')
      sp.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.beginPath();ctx.arc(px,py,rad,0,Math.PI*2);ctx.fillStyle=sp;ctx.fill()
      
      // Crisp limb border
      ctx.beginPath();ctx.arc(px,py,rad,0,Math.PI*2)
      ctx.strokeStyle=limb;ctx.lineWidth=1.2;ctx.stroke()
    }

    // Concentric celestial chronograph ticks
    const drawOrbitTicks = (cx: number, cy: number, r: number, ticks: number, opacity: number, activeAngle: number) => {
      ctx.save()
      
      // Fine orbital track line
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.3})`
      ctx.lineWidth = 0.5
      ctx.stroke()

      // Small tick lines
      for (let i = 0; i < ticks; i++) {
        const angle = (i * 2 * Math.PI) / ticks - Math.PI / 2
        const x1 = cx + (r - 2) * Math.cos(angle)
        const y1 = cy + (r - 2) * Math.sin(angle)
        const x2 = cx + (r + 2) * Math.cos(angle)
        const y2 = cy + (r + 2) * Math.sin(angle)

        let diff = Math.abs(angle - activeAngle)
        while (diff > Math.PI) diff = Math.PI * 2 - diff
        const isClose = diff < 0.22
        const tickOpacity = isClose 
          ? opacity * 2.8 * (1 - diff / 0.22)
          : opacity

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.strokeStyle = isClose
          ? `rgba(168, 85, 247, ${tickOpacity})`
          : `rgba(255, 255, 255, ${tickOpacity})`
        ctx.lineWidth = isClose ? 1.0 : 0.5
        ctx.stroke()
      }
      ctx.restore()
    }

    const drawBloom = (px:number,py:number,r:number,cr:number,cg:number,cb:number,size:number,op:number) => {
      const b=ctx.createRadialGradient(px,py,0,px,py,r*size)
      b.addColorStop(0,`rgba(${cr},${cg},${cb},${op})`)
      b.addColorStop(0.45,`rgba(${cr},${cg},${cb},${op*0.28})`)
      b.addColorStop(1,`rgba(${cr},${cg},${cb},0)`)
      ctx.beginPath();ctx.arc(px,py,r*size,0,Math.PI*2);ctx.fillStyle=b;ctx.fill()
    }

    // ─────────────────────────────────────────────────
    // MAIN DRAW LOOP
    // ─────────────────────────────────────────────────
    function draw() {
      if (!canvas) return
      const W  = canvas.width
      const H  = canvas.height
      if (W === 0 || H === 0) {
        raf = requestAnimationFrame(draw)
        return
      }
      const el = (performance.now()-T0)/1000

      // Smooth mouse interpolation for 3D parallax inertia
      mouse.x += (mouse.tx - mouse.x) * 0.04
      mouse.y += (mouse.ty - mouse.y) * 0.04

      const parallaxX = (mouse.x - W / 2) * 0.015
      const parallaxY = (mouse.y - H / 2) * 0.015

      // Solar system center — responsive + mouse parallax shift
      const CX   = (W > 1024 ? W * 0.34 : W * 0.50) + parallaxX
      const CY   = (W > 1024 ? H * 0.50 : H * 0.30) + parallaxY
      
      // Calculate a safe maximum orbit radius that fits within the screen height/width
      const maxRadius = W > 1024 
        ? Math.min(W * 0.45, H * 0.46)
        : Math.min(W * 0.40, H * 0.40)
      
      // Use maxRadius to establish proportional orbit tracks
      const R_MARS    = maxRadius * 0.40
      const R_EARTH   = maxRadius * 0.70
      const R_URANUS  = maxRadius * 1.00   // was Saturn — now Uranus (ice giant)

      // Base scaling for planet/sun sizes
      const BASE = maxRadius * 0.55

      ctx.clearRect(0,0,W,H)
      // Parallax-shifted starfield drawn with a 20px padding scale offset to prevent edge gaps
      ctx.drawImage(bgCv, -parallaxX * 0.3 - 20, -parallaxY * 0.3 - 20, W + 40, H + 40)

      // Twinkling stars
      twStars.forEach(s => {
        const tw = 0.18 + 0.82*Math.abs(Math.sin(el*s.speed+s.phase))
        ctx.globalAlpha = tw*0.65
        ctx.fillStyle = '#ddeeff'
        ctx.beginPath(); ctx.arc(s.x*W, s.y*H, s.r, 0, Math.PI*2); ctx.fill()
      })
      ctx.globalAlpha = 1

      // Shooting stars
      shooters.forEach(sh => {
        if (!sh.active) {
          if (--sh.timer<=0) {
            sh.x=Math.random()*W*0.7; sh.y=Math.random()*H*0.35
            sh.vx=(Math.random()*4+3)*(Math.random()<0.6?1:-1)
            sh.vy=Math.random()*3+2
            sh.alpha=0.90; sh.len=Math.random()*100+50; sh.active=true
          }
          return
        }
        const tx=sh.x-sh.vx*(sh.len/7), ty=sh.y-sh.vy*(sh.len/7)
        const sg=ctx.createLinearGradient(sh.x,sh.y,tx,ty)
        sg.addColorStop(0,`rgba(255,255,255,${sh.alpha})`)
        sg.addColorStop(0.3,`rgba(180,200,255,${sh.alpha*0.3})`)
        sg.addColorStop(1,'rgba(150,170,255,0)')
        ctx.beginPath(); ctx.moveTo(sh.x,sh.y); ctx.lineTo(tx,ty)
        ctx.strokeStyle=sg; ctx.lineWidth=1.2; ctx.stroke()
        sh.x+=sh.vx*4.5; sh.y+=sh.vy*4.5; sh.alpha-=0.009
        if(sh.alpha<=0||sh.x<-200||sh.x>W+200||sh.y>H+100){
          sh.active=false; sh.timer=Math.random()*250+150
        }
      })

      // ── TIME ──────────────────────────────────────────
      const now  = new Date()
      const hrs  = now.getHours()%12
      const mins = now.getMinutes()
      const secs = now.getSeconds()
      const ms   = now.getMilliseconds()

      const secSmooth = secs + ms/1000
      const minSmooth = mins + secSmooth/60
      const hrSmooth  = hrs  + minSmooth/60

      const angMars   = -Math.PI/2 + (hrSmooth/12)*Math.PI*2
      const angEarth  = -Math.PI/2 + (minSmooth/60)*Math.PI*2
      const angUranus = -Math.PI/2 + (secSmooth/60)*Math.PI*2

      // ── DEEP SPACE NEBULA ───────────────────────────────
      const nebX = CX + Math.sin(el * 0.2) * (W * 0.1)
      const nebY = CY + Math.cos(el * 0.15) * (H * 0.1)
      const nebR = Math.max(W, H) * 0.6
      
      const neb = ctx.createRadialGradient(nebX, nebY, 0, nebX, nebY, nebR)
      neb.addColorStop(0, 'rgba(40, 20, 80, 0.15)')
      neb.addColorStop(0.5, 'rgba(15, 30, 90, 0.05)')
      neb.addColorStop(1, 'rgba(0, 0, 0, 0)')
      
      ctx.globalCompositeOperation = 'screen'
      ctx.beginPath(); ctx.arc(nebX, nebY, nebR, 0, Math.PI * 2); ctx.fillStyle = neb; ctx.fill()
      ctx.globalCompositeOperation = 'source-over'

      // ── Chronograph Dial Rings ──
      // Mars orbit: 12 ticks (Hours)
      drawOrbitTicks(CX, CY, R_MARS, 12, 0.08, angMars)
      // Earth orbit: 60 ticks (Minutes)
      drawOrbitTicks(CX, CY, R_EARTH, 60, 0.05, angEarth)
      // Uranus orbit: 60 ticks (Seconds)
      drawOrbitTicks(CX, CY, R_URANUS, 60, 0.04, angUranus)

      // ── Cosmic Solar Wind Particles ──
      cosmicParticles.forEach(p => {
        p.dist += p.speed * 0.016
        if (p.dist > maxRadius * 1.35) {
          p.dist = BASE * 0.10 + Math.random() * 20
          p.angle = Math.random() * Math.PI * 2
          p.alpha = Math.random() * 0.5 + 0.1
        }
        const px = CX + p.dist * Math.cos(p.angle)
        const py = CY + p.dist * Math.sin(p.angle)
        
        const fade = p.dist < BASE * 0.20
          ? (p.dist - BASE * 0.10) / (BASE * 0.10)
          : (maxRadius * 1.35 - p.dist) / (maxRadius * 0.45)
        const currentAlpha = Math.max(0, p.alpha * Math.min(1, fade))
        
        ctx.fillStyle = `rgba(255, 235, 180, ${currentAlpha * 0.28})`
        ctx.beginPath()
        ctx.arc(px, py, p.size, 0, Math.PI * 2)
        ctx.fill()
      })

      // ── ARC TRAILS (glowing cloud type — like file:130) ──
      // Mars — red-orange arc 55°
      drawArcTrail(CX, CY, R_MARS,   angMars,   55,  220, 85, 40)
      // Earth — blue arc 65°
      drawArcTrail(CX, CY, R_EARTH,  angEarth,  65,  50, 130, 255)
      // Uranus — ice-blue/teal arc 45° (moves fastest = seconds)
      drawArcTrail(CX, CY, R_URANUS, angUranus, 45,  60, 215, 200)

      // ════════════════════════════════════════════════
      // SUN — central pulsing stellar core
      // ════════════════════════════════════════════════
      const sp2 = 1 + 0.05*Math.sin(el*1.5)
      const sunR = BASE * 0.10
      
      // Solar magnetic loops (prominence flares)
      const drawSolarLoop = (a1: number, a2: number, height: number, speed: number) => {
        const p1x = CX + sunR * Math.cos(a1)
        const p1y = CY + sunR * Math.sin(a1)
        const p2x = CX + sunR * Math.cos(a2)
        const p2y = CY + sunR * Math.sin(a2)
        const midA = (a1 + a2) / 2
        const ctrlR = sunR + height * (0.8 + 0.25 * Math.sin(el * speed))
        const ctrlX = CX + ctrlR * Math.cos(midA)
        const ctrlY = CY + ctrlR * Math.sin(midA)

        ctx.beginPath()
        ctx.moveTo(p1x, p1y)
        ctx.quadraticCurveTo(ctrlX, ctrlY, p2x, p2y)
        ctx.strokeStyle = `rgba(255, 140, 40, ${0.18 + 0.12 * Math.sin(el * speed * 1.5)})`
        ctx.lineWidth = 1.2
        ctx.stroke()
      }

      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      drawSolarLoop(el * 0.1, el * 0.1 + 0.5, sunR * 0.6, 1.8)
      drawSolarLoop(el * 0.15 + 2.0, el * 0.15 + 2.4, sunR * 0.8, 1.4)
      drawSolarLoop(el * -0.08 + 4.0, el * -0.08 + 4.6, sunR * 0.5, 2.2)
      ctx.restore()

      // Core intense bloom (controlled)
      drawBloom(CX, CY, sunR, 255,200,80, 4.0*sp2, 0.4)
      // Wide atmospheric scattering
      drawBloom(CX, CY, sunR, 255,100,20, 8.0, 0.1)

      // Extreme far corona (atmospheric scattered light)
      const efc=ctx.createRadialGradient(CX,CY,0,CX,CY,220*sp2)
      efc.addColorStop(0,'rgba(255,160,20,0.06)');efc.addColorStop(0.5,'rgba(255,80,0,0.015)');efc.addColorStop(1,'rgba(255,40,0,0)')
      ctx.beginPath();ctx.arc(CX,CY,220*sp2,0,Math.PI*2);ctx.fillStyle=efc;ctx.fill()
      
      // Inner corona
      const ic=ctx.createRadialGradient(CX,CY,4,CX,CY,70*sp2)
      ic.addColorStop(0,'rgba(255,220,80,0.5)');ic.addColorStop(0.4,'rgba(255,120,20,0.15)');ic.addColorStop(1,'rgba(255,50,0,0)')
      ctx.beginPath();ctx.arc(CX,CY,70*sp2,0,Math.PI*2);ctx.fillStyle=ic;ctx.fill()
      
      // Body
      const sunG=ctx.createRadialGradient(CX-sunR*0.3,CY-sunR*0.3,0,CX,CY,sunR)
      sunG.addColorStop(0,'#ffffff');sunG.addColorStop(0.15,'#fff4b0');sunG.addColorStop(0.4,'#ffd022')
      sunG.addColorStop(0.7,'#f07000');sunG.addColorStop(1,'#801000')
      ctx.beginPath();ctx.arc(CX,CY,sunR,0,Math.PI*2);ctx.fillStyle=sunG;ctx.fill()
      // Shimmer
      ctx.beginPath();ctx.arc(CX,CY,sunR,0,Math.PI*2)
      ctx.strokeStyle=`rgba(255,200,50,${0.15+0.1*Math.sin(el*3.0)})`;ctx.lineWidth=1.5;ctx.stroke()

      // ════════════════════════════════════════════════
      // MARS — Hours (rust red planet)
      // ════════════════════════════════════════════════
      const mxp = CX + R_MARS * Math.cos(angMars)
      const myp = CY + R_MARS * Math.sin(angMars)
      const marsR = BASE * 0.050

      drawBloom(mxp,myp,marsR, 220,90,40, 5.5,0.30)
      drawSphere(mxp,myp,marsR, CX, CY,
        '#ffb080','#e05030','#b02818','#5a0c08','rgba(80,10,0,0.55)', 'rgba(255,100,50,0.4)')
      // Dynamic Polar Cap — always facing away from the Sun
      const m_dx = mxp - CX
      const m_dy = myp - CY
      const m_dist = Math.sqrt(m_dx * m_dx + m_dy * m_dy) || 1
      const m_ux = m_dx / m_dist
      const m_uy = m_dy / m_dist
      
      const pc=ctx.createRadialGradient(mxp + marsR*0.35*m_ux, myp + marsR*0.35*m_uy, 0, mxp + marsR*0.25*m_ux, myp + marsR*0.25*m_uy, marsR*0.32)
      pc.addColorStop(0,'rgba(255,240,240,0.48)')
      pc.addColorStop(1,'rgba(255,255,255,0)')
      ctx.beginPath();ctx.arc(mxp,myp,marsR,0,Math.PI*2);ctx.fillStyle=pc;ctx.fill()

      // ════════════════════════════════════════════════
      // EARTH — Minutes (blue marble with dynamic continents)
      // ════════════════════════════════════════════════
      const exp2 = CX + R_EARTH * Math.cos(angEarth)
      const eyp  = CY + R_EARTH * Math.sin(angEarth)
      const earthR = BASE * 0.070

      // Atmosphere halo
      const eatmo=ctx.createRadialGradient(exp2,eyp,earthR*0.84,exp2,eyp,earthR*1.55)
      eatmo.addColorStop(0,'rgba(80,155,255,0.22)');eatmo.addColorStop(1,'rgba(40,80,255,0)')
      ctx.beginPath();ctx.arc(exp2,eyp,earthR*1.55,0,Math.PI*2);ctx.fillStyle=eatmo;ctx.fill()

      drawBloom(exp2,eyp,earthR, 60,130,255, 2.2,0.22)
      drawSphere(exp2,eyp,earthR, CX, CY,
        '#88ccff','#1a6ed4','#0a42a8','#011e50','rgba(0,15,72,0.55)', 'rgba(80,155,255,0.3)')

      // Continents (dynamically clipped inside Earth's sphere)
      ctx.save()
      ctx.beginPath();ctx.arc(exp2,eyp,earthR,0,Math.PI*2);ctx.clip()
      ;[
        {ox:-0.20,oy:-0.12,rx:0.50,ry:0.36,a:0.0},
        {ox: 0.28,oy: 0.12,rx:0.34,ry:0.44,a:0.4},
        {ox: 0.08,oy: 0.38,rx:0.42,ry:0.26,a:-0.3},
      ].forEach(c=>{
        ctx.save(); ctx.translate(exp2+c.ox*earthR,eyp+c.oy*earthR); ctx.rotate(c.a)
        const cg2=ctx.createRadialGradient(0,0,0,0,0,earthR*(c.rx+c.ry)/2)
        cg2.addColorStop(0,'rgba(55,130,45,0.80)');cg2.addColorStop(0.5,'rgba(72,100,38,0.52)');cg2.addColorStop(1,'rgba(85,65,28,0)')
        ctx.scale(c.rx,c.ry);ctx.beginPath();ctx.arc(0,0,earthR,0,Math.PI*2);ctx.fillStyle=cg2;ctx.fill()
        ctx.restore()
      })
      
      // Dynamic Cloud layers
      ctx.globalAlpha=0.24
      const cloudRot = el * 0.05
      ;[{ox:-0.05 + 0.1 * Math.sin(cloudRot), oy:-0.55},{ox:0.42 + 0.12 * Math.cos(cloudRot),oy:-0.28},{ox:-0.50 + 0.08 * Math.sin(cloudRot * 1.5),oy:0.12},{ox:0.18,oy:0.52 + 0.1 * Math.cos(cloudRot)}].forEach(cp=>{
        const cx2=exp2+cp.ox*earthR,cy2=eyp+cp.oy*earthR
        const cg3=ctx.createRadialGradient(cx2,cy2,0,cx2,cy2,earthR*0.25)
        cg3.addColorStop(0,'rgba(255,255,255,0.38)');cg3.addColorStop(1,'rgba(255,255,255,0)')
        ctx.fillStyle=cg3;ctx.beginPath();ctx.arc(cx2,cy2,earthR*0.25,0,Math.PI*2);ctx.fill()
      })
      ctx.globalAlpha=1; ctx.restore()

      // Specular Reflection (dynamic facing Sun)
      const e_dx = exp2 - CX
      const e_dy = eyp - CY
      const e_dist = Math.sqrt(e_dx * e_dx + e_dy * e_dy) || 1
      const e_ux = e_dx / e_dist
      const e_uy = e_dy / e_dist
      
      const espec=ctx.createRadialGradient(exp2 - earthR*0.35*e_ux, eyp - earthR*0.35*e_uy, 0, exp2 - earthR*0.20*e_ux, eyp - earthR*0.20*e_uy, earthR*0.62)
      espec.addColorStop(0,'rgba(255,255,255,0.46)');espec.addColorStop(1,'rgba(255,255,255,0)')
      ctx.beginPath();ctx.arc(exp2,eyp,earthR,0,Math.PI*2);ctx.fillStyle=espec;ctx.fill()

      // Moon (orbits Earth, shadowed relative to Sun)
      const moonOrbit=earthR*2.0, moonAngle=el*1.0
      const moonX=exp2+moonOrbit*Math.cos(moonAngle), moonY=eyp+moonOrbit*Math.sin(moonAngle)
      const moonR=earthR*0.21
      ctx.beginPath();ctx.arc(exp2,eyp,moonOrbit,0,Math.PI*2)
      ctx.strokeStyle='rgba(150,160,255,0.05)';ctx.lineWidth=0.4;ctx.stroke()
      
      drawBloom(moonX,moonY,moonR, 190,195,180, 2.6,0.14)
      drawSphere(moonX,moonY,moonR, CX, CY, '#e8e8e0','#b0b0a6','#848480','#505050','rgba(50,50,44,0.38)', 'rgba(200,200,200,0.15)')

      // ════════════════════════════════════════════════
      // URANUS — Seconds (ice-blue giant with vertical rings)
      // ════════════════════════════════════════════════
      const uxp = CX + R_URANUS * Math.cos(angUranus)
      const uyp = CY + R_URANUS * Math.sin(angUranus)
      const urR = BASE * 0.062

      // Uranus atmospheric glow — teal/cyan
      const uatmo=ctx.createRadialGradient(uxp,uyp,urR*0.85,uxp,uyp,urR*1.60)
      uatmo.addColorStop(0,'rgba(60,215,195,0.18)');uatmo.addColorStop(1,'rgba(30,180,160,0)')
      ctx.beginPath();ctx.arc(uxp,uyp,urR*1.60,0,Math.PI*2);ctx.fillStyle=uatmo;ctx.fill()

      drawBloom(uxp,uyp,urR, 60,215,200, 4.5,0.25)

      ctx.save()
      ctx.translate(uxp,uyp)

      // Ring dimensions (tilted Cassini-division style)
      const rX = urR * 1.95
      const rY = urR * 0.28   
      const rTilt = 1.18      

      // ── Ring BACK half ──
      ctx.save()
      ctx.beginPath(); ctx.ellipse(0,0,rX,rY,rTilt,Math.PI,0); ctx.clip()
      ctx.strokeStyle='rgba(60,210,195,0.38)'; ctx.lineWidth=urR*0.40
      ctx.beginPath(); ctx.ellipse(0,0,rX*0.88,rY*0.88,rTilt,0,Math.PI*2); ctx.stroke()
      ctx.strokeStyle='rgba(40,180,170,0.22)'; ctx.lineWidth=urR*0.20
      ctx.beginPath(); ctx.ellipse(0,0,rX*1.10,rY*1.10,rTilt,0,Math.PI*2); ctx.stroke()
      ctx.strokeStyle='rgba(4,6,18,0.55)'; ctx.lineWidth=urR*0.08
      ctx.beginPath(); ctx.ellipse(0,0,rX*0.98,rY*0.98,rTilt,0,Math.PI*2); ctx.stroke()
      ctx.restore()

      // ── Uranus BODY — dynamic ice giant light gradient ──
      const u_dx = uxp - CX
      const u_dy = uyp - CY
      const u_dist = Math.sqrt(u_dx * u_dx + u_dy * u_dy) || 1
      const u_ux = u_dx / u_dist
      const u_uy = u_dy / u_dist
      
      const ugx = -urR * 0.35 * u_ux
      const ugy = -urR * 0.35 * u_uy

      const urG=ctx.createRadialGradient(ugx, ugy, 0, 0, 0, urR)
      urG.addColorStop(0,   '#e8fffe')
      urG.addColorStop(0.20,'#a8ede8')
      urG.addColorStop(0.50,'#4cc8c0')
      urG.addColorStop(0.75,'#1a8888')
      urG.addColorStop(1,   '#083838')
      ctx.beginPath();ctx.arc(0,0,urR,0,Math.PI*2);ctx.fillStyle=urG;ctx.fill()
      
      // Bands
      ctx.save()
      ctx.beginPath();ctx.arc(0,0,urR,0,Math.PI*2);ctx.clip()
      ;[
        {y:-urR*0.18,h:urR*0.12,col:'rgba(200,255,252,0.14)'},
        {y: urR*0.20,h:urR*0.09,col:'rgba(180,248,245,0.09)'},
      ].forEach(bd=>{ctx.fillStyle=bd.col;ctx.fillRect(-urR,bd.y,urR*2,bd.h)})
      ctx.restore()
      
      // Specular highlight
      const uspec=ctx.createRadialGradient(ugx, ugy, 0, -urR * 0.15 * u_ux, -urR * 0.15 * u_uy, urR*0.62)
      uspec.addColorStop(0,'rgba(255,255,255,0.55)');uspec.addColorStop(1,'rgba(255,255,255,0)')
      ctx.beginPath();ctx.arc(0,0,urR,0,Math.PI*2);ctx.fillStyle=uspec;ctx.fill()
      
      // Limb outline
      ctx.beginPath();ctx.arc(0,0,urR,0,Math.PI*2)
      ctx.strokeStyle='rgba(8,48,48,0.50)';ctx.lineWidth=0.9;ctx.stroke()

      // ── Ring FRONT half ──
      ctx.save()
      ctx.beginPath(); ctx.ellipse(0,0,rX,rY,rTilt,0,Math.PI); ctx.clip()
      ctx.strokeStyle='rgba(70,225,210,0.84)'; ctx.lineWidth=urR*0.40
      ctx.beginPath(); ctx.ellipse(0,0,rX*0.88,rY*0.88,rTilt,0,Math.PI*2); ctx.stroke()
      ctx.strokeStyle='rgba(50,195,182,0.58)'; ctx.lineWidth=urR*0.20
      ctx.beginPath(); ctx.ellipse(0,0,rX*1.10,rY*1.10,rTilt,0,Math.PI*2); ctx.stroke()
      ctx.strokeStyle='rgba(4,6,18,0.72)'; ctx.lineWidth=urR*0.08
      ctx.beginPath(); ctx.ellipse(0,0,rX*0.98,rY*0.98,rTilt,0,Math.PI*2); ctx.stroke()
      ctx.restore()

      ctx.restore() // end Uranus translate

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', setSize)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:'absolute', inset:0,
        width:'100%', height:'100%',
        display:'block', zIndex:0,
        pointerEvents:'none',
      }}
    />
  )
}
