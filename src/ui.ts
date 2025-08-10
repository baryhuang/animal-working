export type DialogHandle = {
  show: (lines: string[]) => void;
  hide: () => void;
  setPrompt: (text: string | null) => void;
  ask?: (question: string, choices: string[]) => Promise<number>;
  cancelAsk?: () => void;
  showStartModal?: (onSubmit: (company: string, role: string, name: string) => void) => void;
  toggleCluePanel?: () => void;
  setClues?: (items: string[], score: number, hour: number) => void;
  showVictory?: (opts: { score: number; rating?: string; onRestart: () => void; achievements?: { label: string; points: number }[] }) => void;
  hideVictory?: () => void;
};

export function createUI(): DialogHandle {
  const hud = document.getElementById('hud')!;
  let dialog = document.getElementById('dialog');
  if (!dialog) {
    dialog = document.createElement('div');
    dialog.id = 'dialog';
    dialog.className = 'dialog hidden';
    hud.after(dialog);
  }
  let chooser = document.getElementById('chooser');
  if (!chooser) {
    chooser = document.createElement('div');
    chooser.id = 'chooser';
    chooser.className = 'chooser hidden';
    hud.after(chooser);
  }
  let prompt = document.getElementById('prompt');
  if (!prompt) {
    prompt = document.createElement('div');
    prompt.id = 'prompt';
    prompt.className = 'prompt hidden';
    hud.after(prompt);
  }

  const show = (lines: string[]) => {
    dialog!.innerHTML = lines.map(l => `<div class="line">${l}</div>`).join('');
    dialog!.classList.remove('hidden');
  };
  const hide = () => {
    dialog!.classList.add('hidden');
  };
  const setPrompt = (text: string | null) => {
    if (!text) {
      prompt!.classList.add('hidden');
      prompt!.textContent = '';
      return;
    }
    prompt!.textContent = text;
    prompt!.classList.remove('hidden');
  };

  let closeChooser: (() => void) | null = null;

  const ask = (question: string, choices: string[]): Promise<number> => {
    return new Promise(resolve => {
      chooser!.innerHTML = [
        `<div class="q">${question}</div>`,
        `<div class="opts">${choices
          .map((c, i) => `<button data-idx="${i}" class="opt">${c}</button>`) 
          .join('')}</div>`
      ].join('');
      chooser!.classList.remove('hidden');
      const onClick = (e: Event) => {
        const target = e.target as HTMLElement;
        const idxAttr = target.getAttribute('data-idx');
        if (idxAttr == null) return;
        const idx = Number(idxAttr);
        chooser!.classList.add('hidden');
        chooser!.removeEventListener('click', onClick);
        closeChooser = null;
        resolve(idx);
      };
      chooser!.addEventListener('click', onClick);
      closeChooser = () => {
        chooser!.classList.add('hidden');
        chooser!.removeEventListener('click', onClick);
        closeChooser = null;
      };
    });
  };

  const cancelAsk = () => { closeChooser?.(); };

  // Start modal (simple)
  const showStartModal = (onSubmit: (company: string, role: string, name: string) => void) => {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);z-index:20;';
    div.innerHTML = `
      <div style="background:#12161f;padding:16px 18px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);min-width:320px;color:#e6f1ff;font-family:Inter,sans-serif;">
        <div style="font-weight:700;margin-bottom:8px;">Start Your Day</div>
        <label>Company<input id="m_company" value="Peakmojo" style="width:100%;margin:4px 0 8px;padding:6px;border-radius:8px;border:1px solid #2a3340;background:#0b0f17;color:#dfeaff;"></label>
        <label>Role<input id="m_role" value="Software Engineer Intern" style="width:100%;margin:4px 0 8px;padding:6px;border-radius:8px;border:1px solid #2a3340;background:#0b0f17;color:#dfeaff;"></label>
        <label>Name<input id="m_name" value="Andy" style="width:100%;margin:4px 0 12px;padding:6px;border-radius:8px;border:1px solid #2a3340;background:#0b0f17;color:#dfeaff;"></label>
        <button id="m_ok" style="padding:8px 10px;border-radius:8px;border:1px solid #3c9ee7;background:#1a2635;color:#aee2ff;cursor:pointer;">Start</button>
      </div>`;
    document.body.appendChild(div);
    // prevent game hotkeys from firing while typing in modal
    const stop = (e: Event) => { e.stopPropagation(); };
    div.addEventListener('keydown', stop, true);
    div.addEventListener('keypress', stop, true);
    div.addEventListener('keyup', stop, true);
    (div.querySelector('#m_ok') as HTMLButtonElement).onclick = () => {
      const company = (div.querySelector('#m_company') as HTMLInputElement).value || 'Peak Mojo';
      const role = (div.querySelector('#m_role') as HTMLInputElement).value || 'Engineer Intern';
      const name = (div.querySelector('#m_name') as HTMLInputElement).value || 'Intern';
      onSubmit(company, role, name);
      div.remove();
    };
    // focus first input for immediate typing
    (div.querySelector('#m_company') as HTMLInputElement).focus();
  };

  // Minimal clue panel
  let clueDiv: HTMLElement | null = null;
  const ensureClues = () => {
    if (!clueDiv) {
      clueDiv = document.createElement('div');
      clueDiv.style.cssText = 'position:fixed;top:12px;right:16px;max-width:360px;background:rgba(12,14,20,0.75);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px;color:#dfeaff;z-index:12;font-family:Inter,sans-serif;';
      clueDiv.innerHTML = '<div id="clue_head" style="display:flex;justify-content:space-between;align-items:center;gap:8px;cursor:pointer;"><div>Clues & Time</div><div id="clue_toggle">▲</div></div><div id="clue_body" style="margin-top:8px;font-size:12px;line-height:1.3"></div>';
      document.body.appendChild(clueDiv);
      clueDiv.querySelector('#clue_head')!.addEventListener('click', () => toggleCluePanel());
    }
  };
  let collapsed = false;
  const toggleCluePanel = () => {
    ensureClues();
    collapsed = !collapsed;
    (clueDiv!.querySelector('#clue_body') as HTMLElement).style.display = collapsed ? 'none' : 'block';
    (clueDiv!.querySelector('#clue_toggle') as HTMLElement).textContent = collapsed ? '▼' : '▲';
  };
  const setClues = (items: string[], score: number, hour: number) => {
    ensureClues();
    const body = clueDiv!.querySelector('#clue_body') as HTMLElement;
    const timeStr = `${hour}:00`;
    body.innerHTML = [`<div style="opacity:0.8;margin-bottom:6px;">Time: ${timeStr} · Score: ${score}</div>`,
      ...items.map(i => `<div>• ${i}</div>`) ].join('');
  };

  // Victory overlay
  let victoryDiv: HTMLElement | null = null;
  const hideVictory = () => { victoryDiv?.remove(); victoryDiv = null; };
  const showVictory = (opts: { score: number; rating?: string; onRestart: () => void; achievements?: { label: string; points: number }[] }) => {
    hideVictory();
    const { score, rating, onRestart, achievements } = opts;
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed','inset:0','z-index:50',
      'display:flex','align-items:center','justify-content:center',
      'background: radial-gradient(1200px 800px at 50% 30%, rgba(20,24,34,0.92) 0%, rgba(10,12,18,0.94) 60%, rgba(6,7,11,0.98) 100%)'
    ].join(';');
    const card = document.createElement('div');
    card.style.cssText = [
      'background: linear-gradient(180deg, rgba(26,32,40,0.9), rgba(14,18,26,0.9))',
      'border: 1px solid rgba(255,255,255,0.08)',
      'box-shadow: 0 30px 80px rgba(0,0,0,0.6)',
      'border-radius: 16px','padding: 22px 26px','min-width: 420px','text-align:center',
      'color:#e6f1ff','font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif'
    ].join(';');
    const title = document.createElement('div');
    title.textContent = 'Victory!';
    title.style.cssText = 'font-family: Orbitron, sans-serif; font-weight:700; font-size:28px; letter-spacing:0.04em; color:#2ce6ff; margin-bottom:10px;';
    const sub = document.createElement('div');
    sub.textContent = `Final Score: ${score}${rating ? ` · ${rating}` : ''}`;
    sub.style.cssText = 'opacity:0.9;margin-bottom:16px;';

    const list = document.createElement('div');
    if (achievements && achievements.length) {
      list.style.cssText = 'text-align:left;margin:0 auto 14px auto;max-height:220px;overflow:auto;width:min(520px,70vw);font-size:13px;';
      const ul = document.createElement('ul');
      ul.style.cssText = 'margin:0;padding-left:18px;';
      achievements.forEach(a => {
        const li = document.createElement('li');
        li.textContent = `${a.label} (+${a.points})`;
        ul.appendChild(li);
      });
      list.appendChild(ul);
    }
    const btn = document.createElement('button');
    btn.textContent = 'Play Again';
    btn.style.cssText = [
      'padding:10px 14px','border-radius:10px','cursor:pointer',
      'background: rgba(44,230,255,0.12)','color:#a8f0ff',
      'border:1px solid rgba(44,230,255,0.35)','font-weight:600'
    ].join(';');
    btn.onclick = () => { try { onRestart(); } catch {} };
    card.appendChild(title);
    card.appendChild(sub);
    if (list.children.length) card.appendChild(list);
    card.appendChild(btn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    victoryDiv = overlay;
  };

  return { show, hide, setPrompt, ask, cancelAsk, showStartModal, toggleCluePanel, setClues, showVictory, hideVictory };
}


