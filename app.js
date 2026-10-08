/* global Vue, ImageData */

new Vue({
  el: '#app',

  data() {
    return {
      img: null,
      imgLoaded: false,
      naturalW: 0,
      naturalH: 0,

      originalImageData: null,

      // 选区（原图像素坐标）
      sel: null,
      isDrawing: false,
      startX: 0,
      startY: 0,

      // 参数
      warpType: 'radial',
      strength: 50,
      direction: 'inverse'
    };
  },

  computed: {
    wrapStyle() {
      return {};
    }
  },

  mounted() {
    this.bindEvents();
  },

  beforeDestroy() {
    this.unbindEvents();
  },

  methods: {
    /* ================= 事件绑定 ================= */
    bindEvents() {
      const overlay = this.$refs.overlay;
      if (!overlay) return;

      // 鼠标事件
      this._onMouseDown = (e) => this.onPointerDown(e, 'mouse');
      this._onMouseMove = (e) => this.onPointerMove(e, 'mouse');
      this._onMouseUp = (e) => this.onPointerUp(e, 'mouse');

      // 触摸事件（passive: false 以允许 preventDefault）
      this._onTouchStart = (e) => this.onPointerDown(e, 'touch');
      this._onTouchMove = (e) => this.onPointerMove(e, 'touch');
      this._onTouchEnd = (e) => this.onPointerUp(e, 'touch');

      overlay.addEventListener('mousedown', this._onMouseDown);
      window.addEventListener('mousemove', this._onMouseMove);
      window.addEventListener('mouseup', this._onMouseUp);

      overlay.addEventListener('touchstart', this._onTouchStart, { passive: false });
      window.addEventListener('touchmove', this._onTouchMove, { passive: false });
      window.addEventListener('touchend', this._onTouchEnd);
      window.addEventListener('touchcancel', this._onTouchEnd);
    },

    unbindEvents() {
      const overlay = this.$refs.overlay;
      if (!overlay) return;

      overlay.removeEventListener('mousedown', this._onMouseDown);
      window.removeEventListener('mousemove', this._onMouseMove);
      window.removeEventListener('mouseup', this._onMouseUp);

      overlay.removeEventListener('touchstart', this._onTouchStart);
      window.removeEventListener('touchmove', this._onTouchMove);
      window.removeEventListener('touchend', this._onTouchEnd);
      window.removeEventListener('touchcancel', this._onTouchEnd);
    },

    /* ================= 统一指针事件处理 ================= */
    onPointerDown(e, type) {
      if (!this.imgLoaded) return;
      // 触摸时阻止页面滚动
      if (type === 'touch') {
        e.preventDefault();
      }
      const p = this.getPos(e, type);
      if (!p) return;

      this.isDrawing = true;
      this.startX = p.x;
      this.startY = p.y;
      this.sel = { x: p.x, y: p.y, w: 0, h: 0 };
      this.drawOverlay();
    },

    onPointerMove(e, type) {
      if (!this.isDrawing) return;
      // 触摸时阻止页面滚动
      if (type === 'touch') {
        e.preventDefault();
      }
      const p = this.getPos(e, type);
      if (!p) return;

      const x = Math.min(this.startX, p.x);
      const y = Math.min(this.startY, p.y);
      const w = Math.abs(p.x - this.startX);
      const h = Math.abs(p.y - this.startY);
      this.sel = { x, y, w, h };
      this.drawOverlay();
    },

    onPointerUp(e, type) {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      if (this.sel && (this.sel.w < 2 || this.sel.h < 2)) {
        this.sel = null;
      }
      this.drawOverlay();
    },

    /* ================= 获取坐标（鼠标 / 触摸通用） ================= */
    getPos(e, type) {
      const overlay = this.$refs.overlay;
      const rect = overlay.getBoundingClientRect();

      let clientX, clientY;

      if (type === 'touch') {
        // 触摸事件，取第一个触点
        if (e.touches && e.touches.length > 0) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
          // touchend 时用 changedTouches
          clientX = e.changedTouches[0].clientX;
          clientY = e.changedTouches[0].clientY;
        } else {
          return null;
        }
      } else {
        // 鼠标事件
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const scaleX = this.naturalW / rect.width;
      const scaleY = this.naturalH / rect.height;

      let x = (clientX - rect.left) * scaleX;
      let y = (clientY - rect.top) * scaleY;

      x = Math.max(0, Math.min(this.naturalW, x));
      y = Math.max(0, Math.min(this.naturalH, y));

      return { x, y };
    },

    /* ================= 图片加载 ================= */
    handleUploadChange(file) {
      const raw = file.raw;
      if (!raw) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.loadImage(e.target.result);
      };
      reader.readAsDataURL(raw);
    },

    loadImage(src) {
      const img = new Image();
      img.onload = () => {
        this.img = img;
        this.imgLoaded = true;
        this.naturalW = img.naturalWidth;
        this.naturalH = img.naturalHeight;
        this.sel = null;
        this.$nextTick(() => {
          this.initCanvas();
        });
      };
      img.src = src;
    },

    initCanvas() {
      const canvas = this.$refs.canvas;
      const overlay = this.$refs.overlay;

      canvas.width = this.naturalW;
      canvas.height = this.naturalH;
      overlay.width = this.naturalW;
      overlay.height = this.naturalH;

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(this.img, 0, 0);

      this.originalImageData = ctx.getImageData(0, 0, this.naturalW, this.naturalH);

      this.clearSel();
      this.drawOverlay();
    },

    resetImage() {
      if (!this.imgLoaded) return;
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(this.img, 0, 0);
      this.clearSel();
      this.$message.success('已重置');
    },

    download() {
      if (!this.imgLoaded) return;
      const canvas = this.$refs.canvas;
      const a = document.createElement('a');
      a.download = 'warped-image.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    },

    /* ================= 绘制选区 ================= */
    drawOverlay() {
      const overlay = this.$refs.overlay;
      if (!overlay) return;
      const ctx = overlay.getContext('2d');
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      if (this.sel && this.sel.w > 0 && this.sel.h > 0) {
        const s = this.sel;
        ctx.fillStyle = 'rgba(64, 158, 255, 0.15)';
        ctx.fillRect(s.x, s.y, s.w, s.h);

        ctx.strokeStyle = '#409eff';
        ctx.lineWidth = Math.max(2, this.naturalW / 400); // 手机端线稍粗
        ctx.setLineDash([8, 5]);
        ctx.strokeRect(s.x, s.y, s.w, s.h);
        ctx.setLineDash([]);
      }
    },

    selectAll() {
      if (!this.imgLoaded) return;
      this.sel = { x: 0, y: 0, w: this.naturalW, h: this.naturalH };
      this.drawOverlay();
    },

    selectCenter() {
      if (!this.imgLoaded) return;
      const w = this.naturalW * 0.5;
      const h = this.naturalH * 0.5;
      this.sel = {
        x: (this.naturalW - w) / 2,
        y: (this.naturalH - h) / 2,
        w,
        h
      };
      this.drawOverlay();
    },

    clearSel() {
      this.sel = null;
      this.drawOverlay();
    },

    /* ================= 扭曲主流程 ================= */
    applyWarp() {
      if (!this.imgLoaded || !this.originalImageData) {
        this.$message.warning('请先加载图片');
        return;
      }
      if (!this.sel || this.sel.w < 2 || this.sel.h < 2) {
        this.$message.warning('请先框选有效区域');
        return;
      }

      // 显示加载提示（大图处理可能耗时）
      const loading = this.$loading({
        lock: true,
        text: '正在处理中...',
        spinner: 'el-icon-loading',
        background: 'rgba(255, 255, 255, 0.7)'
      });

      // 用 setTimeout 让 loading 先渲染出来
      setTimeout(() => {
        let result;
        try {
          if (this.direction === 'inverse') {
            result = this.inverseWarp(this.originalImageData, this.sel);
          } else {
            result = this.forwardWarp(this.originalImageData, this.sel);
          }

          const canvas = this.$refs.canvas;
          const ctx = canvas.getContext('2d');
          ctx.putImageData(result, 0, 0);

          this.$message.success('扭曲完成');
        } catch (err) {
          console.error(err);
          this.$message.error('处理失败，请重试');
        } finally {
          loading.close();
        }
      }, 50);
    },

    /* ================= 反向扭曲 ================= */
    inverseWarp(srcData, sel) {
      const w = srcData.width;
      const h = srcData.height;
      const dst = new ImageData(w, h);
      dst.data.set(srcData.data);

      const cx = sel.x + sel.w / 2;
      const cy = sel.y + sel.h / 2;

      const x0 = Math.max(0, Math.floor(sel.x));
      const y0 = Math.max(0, Math.floor(sel.y));
      const x1 = Math.min(w, Math.ceil(sel.x + sel.w));
      const y1 = Math.min(h, Math.ceil(sel.y + sel.h));

      for (let v = y0; v < y1; v++) {
        for (let u = x0; u < x1; u++) {
          const pt = this.mapInverse(u, v, cx, cy, sel);
          const sx = pt.x;
          const sy = pt.y;

          const color = this.bilinearSample(srcData, sx, sy);
          const idx = (v * w + u) * 4;
          dst.data[idx] = color[0];
          dst.data[idx + 1] = color[1];
          dst.data[idx + 2] = color[2];
          dst.data[idx + 3] = color[3];
        }
      }

      return dst;
    },

    mapInverse(u, v, cx, cy, sel) {
      const type = this.warpType;
      const k = this.strength / 100;

      if (type === 'radial') {
        const R = Math.min(sel.w, sel.h) / 2;
        const dx = u - cx;
        const dy = v - cy;
        const r = Math.sqrt(dx * dx + dy * dy) / R;
        const f = 1 + k * r * r;
        return { x: cx + dx * f, y: cy + dy * f };
      }

      if (type === 'swirl') {
        const R = Math.min(sel.w, sel.h) / 2;
        const dx = u - cx;
        const dy = v - cy;
        const r = Math.sqrt(dx * dx + dy * dy);
        const normR = Math.min(r / R, 1);
        const theta = Math.atan2(dy, dx);
        const maxAngle = k * Math.PI;
        const srcTheta = theta + maxAngle * (1 - normR);
        return {
          x: cx + r * Math.cos(srcTheta),
          y: cy + r * Math.sin(srcTheta)
        };
      }

      if (type === 'wave') {
        const A = (this.strength / 100) * (sel.w * 0.1);
        const wavelength = sel.h / 2;
        const sx = u + A * Math.sin(2 * Math.PI * (v - cy) / wavelength);
        const sy = v;
        return { x: sx, y: sy };
      }

      return { x: u, y: v };
    },

    /* ================= 正向扭曲 ================= */
    forwardWarp(srcData, sel) {
      const w = srcData.width;
      const h = srcData.height;
      const dst = new ImageData(w, h);
      dst.data.set(srcData.data);

      const cx = sel.x + sel.w / 2;
      const cy = sel.y + sel.h / 2;

      const x0 = Math.max(0, Math.floor(sel.x));
      const y0 = Math.max(0, Math.floor(sel.y));
      const x1 = Math.min(w, Math.ceil(sel.x + sel.w));
      const y1 = Math.min(h, Math.ceil(sel.y + sel.h));

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const pt = this.mapForward(x, y, cx, cy, sel);
          const tx = Math.round(pt.x);
          const ty = Math.round(pt.y);

          if (tx < 0 || tx >= w || ty < 0 || ty >= h) continue;

          const srcIdx = (y * w + x) * 4;
          const dstIdx = (ty * w + tx) * 4;

          dst.data[dstIdx] = srcData.data[srcIdx];
          dst.data[dstIdx + 1] = srcData.data[srcIdx + 1];
          dst.data[dstIdx + 2] = srcData.data[srcIdx + 2];
          dst.data[dstIdx + 3] = srcData.data[srcIdx + 3];
        }
      }

      return dst;
    },

    mapForward(x, y, cx, cy, sel) {
      const type = this.warpType;
      const k = this.strength / 100;

      if (type === 'radial') {
        const R = Math.min(sel.w, sel.h) / 2;
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.sqrt(dx * dx + dy * dy) / R;
        const f = 1 + k * r * r;
        return { x: cx + dx / f, y: cy + dy / f };
      }

      if (type === 'swirl') {
        const R = Math.min(sel.w, sel.h) / 2;
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.sqrt(dx * dx + dy * dy);
        const normR = Math.min(r / R, 1);
        const theta = Math.atan2(dy, dx);
        const maxAngle = k * Math.PI;
        const dstTheta = theta - maxAngle * (1 - normR);
        return {
          x: cx + r * Math.cos(dstTheta),
          y: cy + r * Math.sin(dstTheta)
        };
      }

      if (type === 'wave') {
        const A = (this.strength / 100) * (sel.w * 0.1);
        const wavelength = sel.h / 2;
        const tx = x - A * Math.sin(2 * Math.PI * (y - cy) / wavelength);
        const ty = y;
        return { x: tx, y: ty };
      }

      return { x, y };
    },

    /* ================= 双线性插值 ================= */
    bilinearSample(imgData, x, y) {
      const w = imgData.width;
      const h = imgData.height;
      const data = imgData.data;

      if (x < 0) x = 0;
      if (y < 0) y = 0;
      if (x > w - 1) x = w - 1;
      if (y > h - 1) y = h - 1;

      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const x1 = Math.min(x0 + 1, w - 1);
      const y1 = Math.min(y0 + 1, h - 1);

      const dx = x - x0;
      const dy = y - y0;

      const idx00 = (y0 * w + x0) * 4;
      const idx10 = (y0 * w + x1) * 4;
      const idx01 = (y1 * w + x0) * 4;
      const idx11 = (y1 * w + x1) * 4;

      const w00 = (1 - dx) * (1 - dy);
      const w10 = dx * (1 - dy);
      const w01 = (1 - dx) * dy;
      const w11 = dx * dy;

      const r =
        data[idx00] * w00 +
        data[idx10] * w10 +
        data[idx01] * w01 +
        data[idx11] * w11;

      const g =
        data[idx00 + 1] * w00 +
        data[idx10 + 1] * w10 +
        data[idx01 + 1] * w01 +
        data[idx11 + 1] * w11;

      const b =
        data[idx00 + 2] * w00 +
        data[idx10 + 2] * w10 +
        data[idx01 + 2] * w01 +
        data[idx11 + 2] * w11;

      const a =
        data[idx00 + 3] * w00 +
        data[idx10 + 3] * w10 +
        data[idx01 + 3] * w01 +
        data[idx11 + 3] * w11;

      return [r, g, b, a];
    }
  }
});