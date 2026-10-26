'use client'

import { useEffect, useState } from 'react'

/**
 * 进站引导动画（四级刷题站，每会话一次）：
 * 真题册翻开设形 → 题量计数 → 整层淡出揭示。
 * 会话标记由 layout 内联脚本在文档开头完成；prefers-reduced-motion 直接跳过。
 */
export function EntranceOverlay() {
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (document.documentElement.dataset.boot === 'done') {
      setGone(true)
      return
    }
    const onAnimEnd = (e: AnimationEvent) => {
      if (e.animationName === 'c4-exit') {
        document.documentElement.dataset.boot = 'done'
        setGone(true)
      }
    }
    document.addEventListener('animationend', onAnimEnd)
    const fallback = window.setTimeout(() => {
      document.documentElement.dataset.boot = 'done'
      setGone(true)
    }, 6000)
    return () => {
      document.removeEventListener('animationend', onAnimEnd)
      window.clearTimeout(fallback)
    }
  }, [])

  if (gone) return null

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
html[data-boot='done'] .c4-boot{display:none}
.c4-boot{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:radial-gradient(ellipse 80% 55% at 50% 30%,rgba(59,130,246,.1),transparent),#0b1120;font-family:system-ui,sans-serif;animation:c4-exit .55s cubic-bezier(.65,0,.35,1) 2.5s forwards}
.c4-boot .c4-logo{font-size:clamp(28px,5vw,48px);font-weight:800;color:#93c5fd;letter-spacing:.03em;animation:c4-in .5s cubic-bezier(.22,1,.36,1) both}
.c4-boot .c4-book{font-size:clamp(46px,8vw,72px);opacity:0;animation:c4-open .55s cubic-bezier(.34,1.56,.64,1) .35s both}
.c4-boot .c4-bar{width:min(280px,62vw);height:3px;border-radius:999px;overflow:hidden;background:rgba(59,130,246,.16);opacity:0;animation:c4-in .3s ease 1.05s both}
.c4-boot .c4-bar::before{content:'';display:block;height:100%;background:linear-gradient(90deg,#3b82f6,#93c5fd);transform:scaleX(0);transform-origin:left;animation:c4-fill 1.2s cubic-bezier(.3,0,.4,1) 1.15s forwards}
.c4-boot .c4-count{font-family:ui-monospace,monospace;font-size:14px;letter-spacing:.1em;color:#cbd5e1;opacity:0;animation:c4-in .3s ease 1.3s both}
.c4-boot .c4-count b{color:#60a5fa;font-weight:700}
@keyframes c4-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes c4-open{from{opacity:0;transform:scale(.5) rotate(-8deg)}to{opacity:1;transform:none}}
@keyframes c4-fill{to{transform:scaleX(1)}}
@keyframes c4-exit{to{opacity:0;visibility:hidden;transform:scale(1.04)}}
@media (prefers-reduced-motion:reduce){.c4-boot{display:none}}
`,
        }}
      />
      <div className="c4-boot" aria-hidden="true">
        <div className="c4-logo">CET4Lab</div>
        <div className="c4-book">📘</div>
        <div className="c4-bar" />
        <div className="c4-count">
          {'> 真题 '}<b>76 套 · 3980 题</b>{' 已装载 READY'}
        </div>
      </div>
    </>
  )
}
