<script lang="ts">
let nextPanelLayer = 3000;
const panelLayers = new Map<symbol, number>();
</script>

<script setup lang="ts">
import { computed, nextTick, ref, watch, onBeforeUnmount } from "vue";
import { Close, ZoomIn, ZoomOut } from "@element-plus/icons-vue";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  visible: boolean;
  title: string;
  placement?: "left" | "right";
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
}>();

const MIN_SCALE = 0.3;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.2;

const panelEl = ref<HTMLElement | null>(null);
const viewportEl = ref<HTMLElement | null>(null);
const contentEl = ref<HTMLElement | null>(null);
const headerEl = ref<HTMLElement | null>(null);
const scale = ref(1);
const contentWidth = ref(0);
const contentHeight = ref(0);
const layer = ref(3000);
const panelId = Symbol("floating-panel");
let contentObserver: ResizeObserver | null = null;
const screenWidth = ref(window.innerWidth);
const screenHeight = ref(window.innerHeight);
const headerHeight = ref(48);
// 面板左上角位置（fixed 坐标）
const posX = ref(0);
const posY = ref(0);

const contentStyle = computed(() => ({
  transform: `scale(${scale.value})`,
}));
const viewportStyle = computed(() => ({
  width: "100%",
  height: `${contentHeight.value * scale.value + 16}px`,
}));
const panelWidth = computed(() => contentWidth.value * scale.value + 16);
// 大图可拖出屏幕，工具栏独立保持可见，避免看不到底部或拖丢窗口。
const headerStyle = computed(() => {
  const width = 106;
  const x = Math.max(12, Math.min(screenWidth.value - width - 12, posX.value));
  const y = Math.max(12, Math.min(screenHeight.value - headerHeight.value - 12, posY.value));
  return {
    width: `${width}px`,
    transform: `translate(${x - posX.value}px, ${y - posY.value}px)`,
  };
});

function bringToFront() {
  layer.value = ++nextPanelLayer;
  panelLayers.set(panelId, layer.value);
}

function measureContent() {
  if (!contentEl.value) return;
  contentWidth.value = contentEl.value.offsetWidth;
  contentHeight.value = contentEl.value.offsetHeight;
  headerHeight.value = headerEl.value?.offsetHeight ?? 48;
}

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function resetView() {
  scale.value = 1;
}

function close() {
  emit("update:visible", false);
}

// 外框随缩放改变尺寸；移动整窗以保留光标下的内容位置。
function zoomAt(clientX: number, clientY: number, newScale: number) {
  const el = viewportEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const ratio = newScale / scale.value;
  posX.value += (clientX - rect.left - 8) * (1 - ratio);
  posX.value = Math.min(window.innerWidth - 80,
    Math.max(80 - (contentWidth.value * newScale + 16), posX.value));
  posY.value += (clientY - rect.top - 8) * (1 - ratio);
  scale.value = newScale;
}

function zoomBy(factor: number) {
  const oldScale = scale.value;
  const newScale = clampScale(oldScale * factor);
  if (newScale === oldScale) return;
  // 按钮缩放固定左上角，便于原题和答案保持各自的摆放位置。
  scale.value = newScale;
}

function onWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    bringToFront();
    e.preventDefault();
    const oldScale = scale.value;
    const newScale = clampScale(oldScale * Math.pow(1.0015, -e.deltaY));
    if (newScale !== oldScale) {
      zoomAt(e.clientX, e.clientY, newScale);
    }
  }
}

// ============ 面板整体拖拽（header 为拖拽手柄） ============
let panelDrag: { pointerX: number; pointerY: number; posX: number; posY: number } | null = null;

function onHeaderPointerDown(e: PointerEvent) {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  // 点到按钮（缩放/关闭）时不触发拖拽。
  if (!(e.target instanceof Element) || e.target.closest("button")) return;
  if (!panelEl.value) return;
  panelDrag = { pointerX: e.clientX, pointerY: e.clientY, posX: posX.value, posY: posY.value };
  panelEl.value.classList.add("is-dragging");
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onHeaderPointerMove(e: PointerEvent) {
  if (!panelDrag || !panelEl.value) return;
  const width = panelEl.value.offsetWidth;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let nextX = panelDrag.posX + e.clientX - panelDrag.pointerX;
  let nextY = panelDrag.posY + e.clientY - panelDrag.pointerY;
  // 可将长图向上拖至底部；工具栏通过独立偏移保持在屏幕内。
  nextX = Math.min(vw - 80, Math.max(80 - width, nextX));
  nextY = Math.min(vh - 48, Math.max(48 - panelEl.value.offsetHeight, nextY));
  posX.value = nextX;
  posY.value = nextY;
}

function onHeaderPointerUp(e: PointerEvent) {
  if (!panelDrag) return;
  panelDrag = null;
  panelEl.value?.classList.remove("is-dragging");
  const handle = e.currentTarget as HTMLElement;
  if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
}

// 单指保留文字选择和按钮点击；双指才接管内容区手势。
const activePointers = new Map<number, { x: number; y: number }>();
let pinch: { dist: number; scale: number } | null = null;

function onViewportPointerDown(e: PointerEvent) {
  if (e.pointerType === "mouse") return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activePointers.size === 2) {
    const viewport = e.currentTarget as HTMLElement;
    for (const id of activePointers.keys()) viewport.setPointerCapture(id);
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
      zoomAt(midX, midY, newScale);
    }
  }
}

function onViewportPointerUp(e: PointerEvent) {
  activePointers.delete(e.pointerId);
  if (activePointers.size < 2) pinch = null;
}

// ============ 打开时复位到默认位置 ============
function defaultPosition() {
  const vw = window.innerWidth;
  const width = panelEl.value?.offsetWidth ?? 0;
  posX.value = props.placement === "left" ? 12 : Math.max(12, vw - width - 12);
  posY.value = props.placement === "left" ? 12 : 76;
}

function onResize() {
  screenWidth.value = window.innerWidth;
  screenHeight.value = window.innerHeight;
  measureContent();
  const width = panelEl.value?.offsetWidth ?? 0;
  posX.value = Math.min(window.innerWidth - 80, Math.max(80 - width, posX.value));
  const height = panelEl.value?.offsetHeight ?? 0;
  posY.value = Math.min(window.innerHeight - 48, Math.max(48 - height, posY.value));
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== "Escape" || e.defaultPrevented) return;
  if (layer.value !== Math.max(...panelLayers.values())) return;
  e.preventDefault();
  e.stopPropagation();
  close();
}

function cleanup() {
  contentObserver?.disconnect();
  contentObserver = null;
  panelLayers.delete(panelId);
  activePointers.clear();
  pinch = null;
  panelDrag = null;
  window.removeEventListener("keydown", onKeydown, true);
  window.removeEventListener("resize", onResize);
}

watch(
  () => props.visible,
  async (visible, _previous, onCleanup) => {
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
      cleanup();
    });
    if (visible) {
      resetView();
      bringToFront();
      window.addEventListener("keydown", onKeydown, true);
      window.addEventListener("resize", onResize);
      await nextTick();
      if (cancelled || !props.visible || !contentEl.value) return;
      measureContent();
      if (typeof ResizeObserver !== "undefined") {
        contentObserver = new ResizeObserver(measureContent);
        contentObserver.observe(contentEl.value);
        if (headerEl.value) contentObserver.observe(headerEl.value);
      }
      await nextTick();
      if (!cancelled && props.visible) defaultPosition();
    }
  },
  { immediate: true }
);

onBeforeUnmount(cleanup);
</script>

<template>
  <Teleport to="body">
    <Transition name="fap-pop">
      <div
        v-if="visible"
        v-bind="$attrs"
        ref="panelEl"
        class="floating-answer-panel"
        :style="{ left: `${posX}px`, top: `${posY}px`, width: `${panelWidth}px`, zIndex: layer }"
        role="dialog"
        aria-modal="false"
        :aria-label="title"
        @pointerdown.capture="bringToFront"
        @focusin="bringToFront"
      >
        <div
          ref="headerEl"
          class="fap-header"
          :style="headerStyle"
          @pointerdown="onHeaderPointerDown"
          @pointermove="onHeaderPointerMove"
          @pointerup="onHeaderPointerUp"
          @pointercancel="onHeaderPointerUp"
        >
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
          :style="viewportStyle"
          @pointerdown="onViewportPointerDown"
          @pointermove="onViewportPointerMove"
          @pointerup="onViewportPointerUp"
          @pointercancel="onViewportPointerUp"
          @wheel="onWheel"
        >
          <div ref="contentEl" class="fap-content" :style="contentStyle" @load.capture="measureContent">
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
  width: max-content;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.fap-header {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 13px 13px 0 0;
  background: color-mix(in srgb, var(--green) 7%, var(--paper));
  box-shadow: 0 8px 24px rgba(15, 35, 31, 0.16);
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.floating-answer-panel.is-dragging .fap-header {
  cursor: grabbing;
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

.fap-viewport {
  position: relative;
  border: 1px solid var(--line);
  border-top: 0;
  border-radius: 0 0 13px 13px;
  background: var(--paper);
  box-shadow: 0 24px 64px rgba(15, 35, 31, 0.28);
  touch-action: none;
  user-select: text;
}

.fap-content {
  position: absolute;
  top: 8px;
  left: 8px;
  width: max-content;
  transform-origin: 0 0;
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
</style>
