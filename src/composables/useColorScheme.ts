import { ref, watch } from "vue";
import type { ColorSchemeMode } from "../types/practice";

const storageKey = "new-concept-color-scheme";
const supportedModes: ColorSchemeMode[] = ["system", "light", "dark"];

function loadMode(): ColorSchemeMode {
  try {
    const saved = localStorage.getItem(storageKey) as ColorSchemeMode | null;
    return saved && supportedModes.includes(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

export function useColorScheme() {
  const mode = ref<ColorSchemeMode>(loadMode());
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  function applyMode() {
    const dark = mode.value === "dark" || (mode.value === "system" && systemDark.matches);
    document.documentElement.classList.toggle("theme-dark", dark);
    document.documentElement.classList.toggle("theme-light", !dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", dark ? "#08110f" : "#164c45");
  }

  watch(mode, (value) => {
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      // Safari 隐私模式禁用存储时仍允许本次会话切换主题。
    }
    applyMode();
  }, { immediate: true });

  const onSystemChange = () => {
    if (mode.value === "system") applyMode();
  };
  if (typeof systemDark.addEventListener === "function") {
    systemDark.addEventListener("change", onSystemChange);
  } else {
    (systemDark as unknown as { addListener: (listener: () => void) => void }).addListener(onSystemChange);
  }

  return { mode };
}
