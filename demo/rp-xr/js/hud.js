// Head-locked HUD toast: 2D canvas (512x128) rendered to texture,
// drawn in the RP pass at view-space angles (az 0, el -14°), 28° wide.
// Fades out over the last 0.5 seconds.

export class Hud {
  constructor(gl) {
    this.gl = gl;
    this.texture = null;
    this.text = '';
    this.duration = 2.5;
    this.timeRemaining = 0;
    this.alpha = 0;
    this.dirty = false;

    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 512;
      this.canvas.height = 128;
      this.ctx = this.canvas.getContext('2d');
    } else {
      this.canvas = null;
      this.ctx = null;
    }
  }

  init() {
    const gl = this.gl;
    if (!gl) return;

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Initial 1x1 transparent pixel
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0])
    );
  }

  setText(text, seconds = 2.5) {
    this.text = String(text ?? '');
    this.duration = Math.max(0.1, Number(seconds) || 2.5);
    this.timeRemaining = this.duration;
    this.alpha = 1.0;
    this.dirty = true;
    this._renderCanvas();
  }

  update(dt) {
    if (this.timeRemaining <= 0) {
      this.alpha = 0;
      return;
    }
    this.timeRemaining -= dt;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.alpha = 0;
    } else if (this.timeRemaining < 0.5) {
      // Fades out over the last 0.5 seconds
      this.alpha = this.timeRemaining / 0.5;
    } else {
      this.alpha = 1.0;
    }
  }

  getAlpha() {
    return this.alpha;
  }

  // [az center, el center, width, height] in degrees:
  // az 0, el -14°, 28° wide; canvas aspect 512:128 = 4:1 => height = 28 / 4 = 7°
  getRect() {
    return [0, -14, 28, 7];
  }

  _renderCanvas() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);
    if (!this.text) return;

    // Toast pill background
    const pad = 12;
    const radius = 24;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, radius)
      : ctx.rect(pad, pad, w - pad * 2, h - pad * 2);
    ctx.fillStyle = 'rgba(15, 20, 28, 0.88)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();

    // Text rendering
    ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text, w / 2, h / 2, w - 48);
    ctx.restore();
  }

  bind(unit = 1) {
    const gl = this.gl;
    if (!gl || !this.texture) return;

    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    if (this.dirty && this.canvas) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.canvas
      );
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      this.dirty = false;
    }
  }

  dispose() {
    if (this.gl && this.texture) {
      this.gl.deleteTexture(this.texture);
      this.texture = null;
    }
    this.canvas = null;
    this.ctx = null;
  }
}
