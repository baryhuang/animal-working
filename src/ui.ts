export type DialogHandle = {
  show: (lines: string[]) => void;
  hide: () => void;
  setPrompt: (text: string | null) => void;
  ask?: (question: string, choices: string[]) => Promise<number>;
  cancelAsk?: () => void;
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

  return { show, hide, setPrompt, ask, cancelAsk };
}


