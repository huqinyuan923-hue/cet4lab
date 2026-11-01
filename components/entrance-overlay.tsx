'use client'

import { useEffect, useState } from 'react'

/**
 * 进站引导动画（四级真题站风，每会话一次）。
 * 单时钟状态机：layout 内联脚本 playing → 双 rAF → go（CSS 起播），
 * 本组件负责水合后门控淡出——进度条 c4-fill 结束 +150ms 才加 boot-exiting，
 * 淡出动画 c4-exit 结束后切 done 卸载；水合晚于进度条结束时用 getAnimations 补收尾。
 */

const C4_SKILLS = ['听力', '阅读', '写作', '翻译']

const C4_WORDS = [
  { w: 'abandon', p: 'v.', m: '放弃' },
  { w: 'ability', p: 'n.', m: '能力' },
]

const FILL_ANIM = 'c4-fill'
const EXIT_ANIM = 'c4-exit'
const BOOT_FALLBACK_MS = 3400
const EXIT_FALLBACK_MS = 1200

type BootWindow = Window & { __bootT0?: number }

export function EntranceOverlay() {
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    if (root.dataset.boot === 'done') {
      setGone(true)
      return
    }

    let fillTimer = 0
    let fallbackTimer = 0
    let finishTimer = 0

    const finish = () => {
      if (root.dataset.boot === 'done') return
      root.classList.remove('boot-exiting')
      root.dataset.boot = 'done'
      setGone(true)
    }
    const startExit = () => {
      if (root.dataset.boot === 'done' || root.classList.contains('boot-exiting')) return
      root.classList.add('boot-exiting')
      finishTimer = window.setTimeout(finish, EXIT_FALLBACK_MS)
    }
    const onAnimEnd = (e: AnimationEvent) => {
      if (e.animationName === EXIT_ANIM) finish()
      else if (e.animationName === FILL_ANIM) {
        // 进度条跑满后再留一拍，保证单词行也播完才淡出
        fillTimer = window.setTimeout(startExit, 300)
      }
    }
    document.addEventListener('animationend', onAnimEnd)

    if (root.dataset.boot !== 'playing' && root.dataset.boot !== 'go') {
      finish()
      return () => document.removeEventListener('animationend', onAnimEnd)
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish()
      return () => document.removeEventListener('animationend', onAnimEnd)
    }

    // 内联脚本的起播 rAF 若被主线程卡住，这里补一个时钟锚点
    if (root.dataset.boot === 'playing') {
      root.dataset.boot = 'go'
      ;(window as BootWindow).__bootT0 = performance.now()
    }
    const t0 = (window as BootWindow).__bootT0 ?? performance.now()

    // 水合晚于进度条结束时，animationend 已经错过：直接补一个短收尾
    const overlay = document.querySelector<HTMLElement>('.c4-boot')
    const fill = overlay
      ?.getAnimations({ subtree: true })
      .find((a) => (a as CSSAnimation).animationName === FILL_ANIM)
    const fillEnd =
      fill && fill.startTime !== null
        ? Number(fill.startTime) + Number(fill.effect?.getComputedTiming().endTime ?? 0)
        : 0
    if (fillEnd > 0 && fillEnd <= performance.now()) {
      fillTimer = window.setTimeout(startExit, 300)
    }

    fallbackTimer = window.setTimeout(
      startExit,
      Math.max(0, t0 + BOOT_FALLBACK_MS - performance.now())
    )

    return () => {
      document.removeEventListener('animationend', onAnimEnd)
      window.clearTimeout(fillTimer)
      window.clearTimeout(fallbackTimer)
      window.clearTimeout(finishTimer)
    }
  }, [])

  if (gone) return null

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
html[data-boot='done'] .c4-boot{display:none}
.c4-boot{position:fixed;inset:0;z-index:9999;display:none;flex-direction:column;align-items:center;justify-content:center;gap:13px;background:radial-gradient(ellipse 80% 55% at 50% 30%,rgba(59,130,246,.1),transparent),#0b1120;font-family:system-ui,'PingFang SC','Microsoft YaHei',sans-serif;overflow:hidden}
html[data-boot='playing'] .c4-boot,html[data-boot='go'] .c4-boot{display:flex}
html.boot-exiting .c4-boot{animation:c4-exit .5s cubic-bezier(.65,0,.35,1) forwards}
@keyframes c4-exit{to{opacity:0;visibility:hidden;transform:scale(1.04)}}
.c4-boot .c4-logo{display:flex;align-items:baseline;justify-content:center;font-size:clamp(26px,5vw,46px);font-weight:800;letter-spacing:.03em;color:#93c5fd}
.c4-boot .c4-logo i{font-style:normal;margin-right:.28em;font-size:.82em}
.c4-boot .c4-caret{display:inline-block;width:.055em;height:.78em;margin-left:.1em;border-radius:1px;background:#3b82f6;vertical-align:-.02em;animation:c4-blink 1.1s steps(1,end) infinite}
@keyframes c4-blink{0%,55%{opacity:1}56%,100%{opacity:0}}
/* 封面翻开（rotateY + transform-origin，不用 blur） */
.c4-boot .c4-book{position:relative;width:132px;height:84px;perspective:640px}
.c4-boot .c4-pages{position:absolute;inset:0;border-radius:3px 6px 6px 3px;background:linear-gradient(180deg,#e8eefc,#c9d6ef);box-shadow:inset 6px 0 0 rgba(11,17,32,.14)}
.c4-boot .c4-pages::after{content:'';position:absolute;inset:12px 14px 12px 22px;background:repeating-linear-gradient(180deg,rgba(59,130,246,.34) 0 2px,transparent 2px 11px)}
.c4-boot .c4-cover{position:absolute;inset:0;border-radius:3px 6px 6px 3px;background:linear-gradient(135deg,#1d4ed8,#3b82f6 60%,#60a5fa);box-shadow:inset 0 0 0 1px rgba(147,197,253,.45);transform-origin:left center;backface-visibility:hidden;display:flex;align-items:center;justify-content:center;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:15px;letter-spacing:.18em;color:#eaf3ff}
html[data-boot='go'] .c4-boot .c4-cover{animation:c4-flip .62s cubic-bezier(.4,0,.2,1) .12s both}
@keyframes c4-flip{from{transform:rotateY(0)}to{transform:rotateY(-112deg)}}
/* 题量整数计数 */
@property --c4a{syntax:'<integer>';initial-value:0;inherits:false}
@property --c4b{syntax:'<integer>';initial-value:0;inherits:false}
.c4-boot .c4-nums{display:flex;gap:26px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:13px;letter-spacing:.04em;color:#94a3b8}
.c4-boot .c4-nums span{opacity:0}
.c4-boot .c4-nums b{color:#dbeafe;font-weight:700;font-variant-numeric:tabular-nums}
.c4-boot .c4-nums .a{counter-reset:c4an var(--c4a)}
.c4-boot .c4-nums .a b::after{content:counter(c4an)}
.c4-boot .c4-nums .b{counter-reset:c4bn var(--c4b)}
.c4-boot .c4-nums .b b::after{content:counter(c4bn)}
html[data-boot='go'] .c4-boot .c4-nums .a{animation:c4-in .3s ease .9s both,c4-cntA 1s cubic-bezier(.3,0,.4,1) .9s both}
html[data-boot='go'] .c4-boot .c4-nums .b{animation:c4-in .3s ease 1.1s both,c4-cntB 1.1s cubic-bezier(.3,0,.4,1) 1.1s both}
@keyframes c4-cntA{from{--c4a:0}to{--c4a:76}}
@keyframes c4-cntB{from{--c4b:0}to{--c4b:3980}}
/* 技能胶囊 */
.c4-boot .c4-skills{display:flex;gap:9px}
.c4-boot .c4-skills span{padding:4px 13px;border-radius:999px;border:1px solid rgba(59,130,246,.45);background:rgba(59,130,246,.12);color:#bfdbfe;font-size:12.5px;letter-spacing:.06em;opacity:0}
html[data-boot='go'] .c4-boot .c4-skills span{animation:c4-pop .34s cubic-bezier(.34,1.56,.64,1) calc(1.45s + var(--i)*.13s) both}
@keyframes c4-pop{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:none}}
/* 单词行 */
.c4-boot .c4-words{display:flex;flex-direction:column;gap:5px;min-width:min(280px,68vw);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12.5px;color:#94a3b8}
.c4-boot .c4-words .row{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;opacity:0}
.c4-boot .c4-words .row .w{color:#dbeafe;font-weight:600}
.c4-boot .c4-words .row .ck{color:#86efac;font-weight:700;opacity:0}
html[data-boot='go'] .c4-boot .c4-words .row{animation:c4-in .3s cubic-bezier(.2,.7,.3,1) calc(1.75s + var(--i)*.2s) both}
html[data-boot='go'] .c4-boot .c4-words .row .ck{animation:c4-pop .3s cubic-bezier(.34,1.56,.64,1) calc(2.05s + var(--i)*.2s) both}
@keyframes c4-in{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}
/* 进度条 + 百分比 */
.c4-boot .c4-bar{width:min(290px,62vw);height:3px;border-radius:999px;overflow:hidden;background:rgba(59,130,246,.16);opacity:0}
html[data-boot='go'] .c4-boot .c4-bar{animation:c4-in .3s ease .45s both}
.c4-boot .c4-bar::before{content:'';display:block;height:100%;background:linear-gradient(90deg,#3b82f6,#93c5fd);box-shadow:0 0 12px rgba(59,130,246,.7);transform:scaleX(0);transform-origin:left}
html[data-boot='go'] .c4-boot .c4-bar::before{animation:c4-fill 1.9s cubic-bezier(.3,0,.4,1) .6s forwards}
@keyframes c4-fill{to{transform:scaleX(1)}}
@property --c4n{syntax:'<integer>';initial-value:0;inherits:false}
.c4-boot .c4-pct{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;color:#93c5fd;opacity:0;counter-reset:c4n var(--c4n)}
.c4-boot .c4-pct::after{content:counter(c4n) '%'}
html[data-boot='go'] .c4-boot .c4-pct{animation:c4-in .3s ease .5s both,c4-count 1.9s cubic-bezier(.3,0,.4,1) .6s both}
@keyframes c4-count{from{--c4n:0}to{--c4n:100}}
.c4-boot .c4-ready{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:13px;letter-spacing:.3em;color:#86efac;opacity:0}
html[data-boot='go'] .c4-boot .c4-ready{animation:c4-in .3s ease 2.35s both}
@media (prefers-reduced-motion:reduce){html[data-boot='playing'] .c4-boot,html[data-boot='go'] .c4-boot{display:none}}
`,
        }}
      />
      <div className="c4-boot" aria-hidden="true">
        <div className="c4-logo">
          <i>📘</i>CET4Lab
          <span className="c4-caret" />
        </div>
        <div className="c4-book">
          <div className="c4-pages" />
          <div className="c4-cover">CET-4</div>
        </div>
        <div className="c4-nums">
          <span className="a">
            <b /> 套真题
          </span>
          <span className="b">
            <b /> 道题
          </span>
        </div>
        <div className="c4-skills">
          {C4_SKILLS.map((s, i) => (
            <span key={s} style={{ '--i': i } as React.CSSProperties}>
              {s}
            </span>
          ))}
        </div>
        <div className="c4-words">
          {C4_WORDS.map((w, i) => (
            <div key={w.w} className="row" style={{ '--i': i } as React.CSSProperties}>
              <span className="w">{w.w}</span>
              <span>
                {w.p} {w.m}
              </span>
              <span className="ck">✓</span>
            </div>
          ))}
        </div>
        <div className="c4-bar" />
        <div className="c4-pct" />
        <div className="c4-ready">READY</div>
      </div>
    </>
  )
}
