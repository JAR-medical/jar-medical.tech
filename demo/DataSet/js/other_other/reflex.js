export class ReflexGame {
  constructor({ ui, audio }) {
    this.ui = ui;
    this.audio = audio;
    this.panel = document.getElementById("other-reflex-game");
    this.arena = document.getElementById("other-reflex-arena");
    this.target = document.getElementById("other-reflex-target");
    this.startButton = document.getElementById("other-reflex-start");
    this.scoreEl = document.getElementById("other-reflex-score");
    this.timeEl = document.getElementById("other-reflex-time");
    this.messageEl = document.getElementById("other-reflex-message");
    this.running = false;
    this.score = 0;
    this.timeLeft = 15;
    this.interval = null;
    this.target?.addEventListener("click", () => this._hit());
    this.startButton?.addEventListener("click", () => this.start());
  }

  open() {
    if (!this.panel) return;
    this.panel.classList.remove("hidden");
    this._render();
    this.startButton?.focus({ preventScroll: true });
  }

  close() {
    this._stopTimer();
    this.running = false;
    this.panel?.classList.add("hidden");
  }

  start() {
    if (!this.panel || !this.arena || !this.target) return;
    this._stopTimer();
    this.running = true;
    this.score = 0;
    this.timeLeft = 15;
    this.messageEl && (this.messageEl.textContent = "Los! Klicke das Ziel.");
    this.target.classList.remove("hidden");
    this._moveTarget();
    this._render();
    this.audio?.play("ui-confirm");
    this.interval = setInterval(() => {
      this.timeLeft = Math.max(0, this.timeLeft - 0.25);
      this._render();
      if (this.timeLeft <= 0) this._finish();
    }, 250);
  }

  _hit() {
    if (!this.running) return;
    this.score++;
    this.audio?.play("ui-click");
    this._moveTarget();
    this._render();
  }

  _moveTarget() {
    if (!this.arena || !this.target) return;
    const maxX = Math.max(0, this.arena.clientWidth - 62);
    const maxY = Math.max(0, this.arena.clientHeight - 62);
    this.target.style.left = Math.round(Math.random() * maxX) + "px";
    this.target.style.top = Math.round(Math.random() * maxY) + "px";
  }

  _finish() {
    this._stopTimer();
    this.running = false;
    if (this.target) this.target.classList.add("hidden");
    if (this.messageEl) this.messageEl.textContent = "Zeit! " + this.score + " Treffer — nochmal?";
    this.audio?.play("medal");
    this.ui?.toast("🎯 Reflex-Runde: " + this.score + " Treffer.", "good");
  }

  _stopTimer() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  _render() {
    if (this.scoreEl) this.scoreEl.textContent = String(this.score);
    if (this.timeEl) this.timeEl.textContent = this.timeLeft.toFixed(2) + " s";
  }
}
