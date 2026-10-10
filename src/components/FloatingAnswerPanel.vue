<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { Close, ZoomIn, ZoomOut, RefreshLeft, Rank } from "@element-plus/icons-vue";

// 非模态浮动答案面板：无遮罩，可拖拽移动、缩放/平移内容，
// 打开后不挡住题目，方便边看问题边对答案。

const props = defineProps<{
  visible: boolean;
  title: string;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
}>();

const MIN_SCALE = 0.3;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.2;

const panelEl = ref<HTMLElement | null>(null);
const viewportEl = ref<HTMLElement | null>(null);
const scale = ref(1);
const translateX = ref(0);
const translateY = ref(0);
// 面板左上角位置（fixed 坐标）
const posX = ref(0);
const posY = ref(0);

const zoomPercent = computed(() => `${Math.round(scale.value * 100)}%`);
const contentStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
}));

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function resetView() {
  scale.value = 1;
  translateX.value = 0;
  translateY.value = 0;
}

function close() {
  emit("update:visible", false);
}

// 以指定屏幕坐标为锚点缩放（锚点下的内容点保持不动）。
function zoomAt(clientX: number, clientY: number, oldScale: number, newScale: number) {
  const el = viewportEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const cx = clientX - rect.left;
  const cy = clientY - rect.top;
  translateX.value = cx - ((cx - translateX.value) / oldScale) * newScale;
  translateY.value = cy - ((cy - translateY.value) / oldScale) * newScale;
}

function zoomBy(factor: number) {
  const oldScale = scale.value;
  const newScale = clampScale(oldScale * factor);
  if (newScale === oldScale) return;
  const el = viewportEl.value;
  if (el) {
    const rect = el.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, oldScale, newScale);
  }
  scale.value = newScale;
}

function onWheel(e: WheelEvent) {
  // Ctrl/Cmd + 滚轮（含触控板双指缩放）：以光标为锚点缩放；普通滚轮：平移内容。
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const oldScale = scale.value;
    const newScale = clampScale(oldScale * Math.pow(1.0015, -e.deltaY));
    if (newScale !== oldScale) {
      zoomAt(e.clientX, e.clientY, oldScale, newScale);
      scale.value = newScale;
    }
  } else {
    e.preventDefault();
    translateX.value -= e.deltaX;
    translateY.value -= e.deltaY;
  }
}

// ============ 面板整体拖拽（header 为拖拽手柄） ============
let panelDrag: { pointerX: number; pointerY: number; posX: number; posY: number } | null = null;

function onHeaderPointerDown(e: PointerEvent) {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  // 点到按钮（缩放/关闭）时不触发拖拽。
  if ((e.target as HTMLElement).closest("button")) return;
  if (!panelEl.value) return;
  panelDrag = { pointerX: e.clientX, pointerY: e.clientY, posX: posX.value, posY: posY.value };
  panelEl.value.classList.add("is-dragging");
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onHeaderPointerMove(e: PointerEvent) {
  if (!panelDrag || !panelEl.value) return;
  const width = panelEl.value.offsetWidth;
  const height = panelEl.value.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let nextX = panelDrag.posX + e.clientX - panelDrag.pointerX;
  let nextY = panelDrag.posY + e.clientY - panelDrag.pointerY;
  // 至少保留 80px 宽 / 48px 高在可视区内，防止拖丢。
  nextX = Math.min(vw - 80, Math.max(80 - width, nextX));
  nextY = Math.min(vh - 48, Math.max(0, nextY));
  posX.value = nextX;
  posY.value = nextY;
}

function onHeaderPointerUp(e: PointerEvent) {
  if (!panelDrag) return;
  panelDrag = null;
  panelEl.value?.classList.remove("is-dragging");
  try {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  } catch {
    // 指针已释放时忽略。
  }
}

// ============ 内容平移 / 双指捏合缩放（viewport 区域） ============
const activePointers = new Map<number, { x: number; y: number }>();
let contentPan: { x: number; y: number; tx: number; ty: number } | null = null;
let pinch: { dist: number; scale: number } | null = null;

function onViewportPointerDown(e: PointerEvent) {
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activePointers.size === 1) {
    contentPan = { x: e.clientX, y: e.clientY, tx: translateX.value, ty: translateY.value };
    pinch = null;
  } else if (activePointers.size === 2) {
    contentPan = null;
    const [p1, p2] = [...activePointers.values()];
    pinch = { dist: Math.max(Math.hypot(p1.x - p2.x, p1.y - p2.y), 1), scale: scale.value };
  }
}

function onViewportPointerMove(e: PointerEvent) {
  if (!activePointers.has(e.pointerId)) return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activePointers.size === 2 && pinch) {
    const [p1, p2] = [...activePointers.values()];
    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const oldScale = scale.value;
    const newScale = clampScale(pinch.scale * (dist / pinch.dist));
    if (newScale !== oldScale) {
      zoomAt(midX, midY, oldScale, newScale);
      scale.value = newScale;
    }
  } else if (activePointers.size === 1 && contentPan) {
    translateX.value = contentPan.tx + e.clientX - contentPan.x;
    translateY.value = contentPan.ty + e.clientY - contentPan.y;
  }
}

function onViewportPointerUp(e: PointerEvent) {
  activePointers.delete(e.pointerId);
  if (activePointers.size === 1) {
    const [p] = [...activePointers.values()];
    contentPan = { x: p.x, y: p.y, tx: translateX.value, ty: translateY.value };
    pinch = null;
  } else if (activePointers.size === 0) {
    contentPan = null;
    pinch = null;
  }
}

// ============ 打开时复位到默认位置 ============
function defaultPosition() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = vw <= 640;
  const width = mobile ? vw - 24 : 460;
  const height = mobile ? Math.min(vh * 0.46, 380) : Math.min(vh * 0.72, 760);
  return {
    x: mobile ? 12 : vw - width - 24,
    y: mobile ? vh - height - 12 : Math.max(12, (vh - height) / 2),
  };
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") close();
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      resetView();
      const { x, y } = defaultPosition();
      posX.value = x;
      posY.value = y;
      window.addEventListener("keydown", onKeydown);
    } else {
      window.removeEventListener("keydown", onKeydown);
    }
  }
);

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="fap-pop">
      <div
        v-if="visible"
        ref="panelEl"
        class="floating-answer-panel"
        :style="{ left: `${posX}px`, top: `${posY}px` }"
        role="dialog"
        aria-modal="false"
      >
        <div
          class="fap-header"
          @pointerdown="onHeaderPointerDown"
          @pointermove="onHeaderPointerMove"
          @pointerup="onHeaderPointerUp"
          @pointercancel="onHeaderPointerUp"
        >
          <el-icon class="fap-drag-icon" aria-hidden="true"><Rank /></el-icon>
          <span class="fap-title">{{ title }}</span>
          <div class="fap-controls">
            <button
              type="button"
              class="fap-btn"
              title="缩小（Ctrl/⌘ + 滚轮向下）"
              aria-label="缩小"
              @click="zoomBy(1 / ZOOM_STEP)"
            >
              <el-icon><ZoomOut /></el-icon>
            </button>
            <span class="fap-zoom-percent" aria-label="当前缩放比例">{{ zoomPercent }}</span>
            <button
              type="button"
              class="fap-btn"
              title="放大（Ctrl/⌘ + 滚轮向上）"
              aria-label="放大"
              @click="zoomBy(ZOOM_STEP)"
            >
              <el-icon><ZoomIn /></el-icon>
            </button>
            <button
              type="button"
              class="fap-btn"
              title="重置缩放与位置"
              aria-label="重置"
              @click="resetView"
            >
              <el-icon><RefreshLeft /></el-icon>
            </button>
            <button
              type="button"
              class="fap-btn fap-close"
              title="关闭（Esc）"
              aria-label="关闭"
              @click="close"
            >
              <el-icon><Close /></el-icon>
            </button>
          </div>
        </div>
        <div
          ref="viewportEl"
          class="fap-viewport"
          @pointerdown="onViewportPointerDown"
          @pointermove="onViewportPointerMove"
          @pointerup="onViewportPointerUp"
          @pointercancel="onViewportPointerUp"
          @wheel="onWheel"
        >
          <div class="fap-content" :style="contentStyle">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.floating-answer-panel {
  position: fixed;
  z-index: 3000;
  width: 460px;
  height: min(72vh, 760px);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--paper);
  box-shadow: 0 24px 64px rgba(15, 35, 31, 0.28);
  overflow: hidden;
}

.fap-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 8px 12px;
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--green) 7%, var(--paper));
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.floating-answer-panel.is-dragging .fap-header {
  cursor: grabbing;
}

.fap-drag-icon {
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 15px;
}

.fap-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--ink);
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fap-controls {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 3px;
}

.fap-btn {
  width: 26px;
  height: 26px;
  padding: 0;
  display: grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.fap-btn:hover,
.fap-btn:focus-visible {
  border-color: var(--line);
  background: var(--paper);
  color: var(--green);
  outline: none;
}

.fap-btn.fap-close:hover,
.fap-btn.fap-close:focus-visible {
  border-color: var(--coral);
  color: var(--coral);
}

.fap-zoom-percent {
  min-width: 42px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.fap-viewport {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  background: color-mix(in srgb, var(--ink) 4%, var(--paper));
  touch-action: none;
  cursor: grab;
}

.fap-viewport:active {
  cursor: grabbing;
}

.fap-content {
  position: absolute;
  top: 0;
  left: 0;
  width: max-content;
  transform-origin: 0 0;
  padding: 12px;
}

.fap-pop-enter-active,
.fap-pop-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.fap-pop-enter-from,
.fap-pop-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

@media (max-width: 640px) {
  .floating-answer-panel {
    width: calc(100vw - 24px);
    height: min(46vh, 380px);
  }
}
</style>
