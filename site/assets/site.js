const copy = document.querySelector('#copy-command');
const status = document.querySelector('#copy-status');

if (navigator.clipboard) {
  copy.hidden = false;
  let reset;

  copy.addEventListener('click', async () => {
    const platform = document.querySelector('input[name="platform"]:checked');
    const command = document
      .getElementById(platform.getAttribute('aria-controls'))
      .querySelector('code');
    clearTimeout(reset);
    try {
      await navigator.clipboard.writeText(command.textContent);
      copy.textContent = 'Copied';
      status.textContent = 'Install command copied to the clipboard.';
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(command);
      selection.removeAllRanges();
      selection.addRange(range);
      copy.textContent = 'Copy manually';
      status.textContent =
        'Clipboard access was unavailable. The command is selected so you can copy it manually.';
    }
    reset = setTimeout(() => {
      copy.textContent = 'Copy command';
      status.textContent = '';
    }, 2500);
  });
}
