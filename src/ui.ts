export type DialogHandle = {
  show: (lines: string[]) => void;
  hide: () => void;
  setPrompt: (text: string | null) => void;
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

  return { show, hide, setPrompt };
}


