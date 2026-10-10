import { createApp } from "vue";
import ElButton from "element-plus/es/components/button/index.mjs";
import ElConfigProvider from "element-plus/es/components/config-provider/index.mjs";
import ElDialog from "element-plus/es/components/dialog/index.mjs";
import ElEmpty from "element-plus/es/components/empty/index.mjs";
import ElIcon from "element-plus/es/components/icon/index.mjs";
import ElInput from "element-plus/es/components/input/index.mjs";
import ElOption from "element-plus/es/components/option/index.mjs";
import ElProgress from "element-plus/es/components/progress/index.mjs";
import ElSegmented from "element-plus/es/components/segmented/index.mjs";
import ElSelect from "element-plus/es/components/select/index.mjs";
import ElSlider from "element-plus/es/components/slider/index.mjs";
import ElSwitch from "element-plus/es/components/switch/index.mjs";
import ElTabPane from "element-plus/es/components/tab-pane/index.mjs";
import ElTabs from "element-plus/es/components/tabs/index.mjs";
import ElTooltip from "element-plus/es/components/tooltip/index.mjs";
import "element-plus/es/components/button/style/css.mjs";
import "element-plus/es/components/config-provider/style/css.mjs";
import "element-plus/es/components/dialog/style/css.mjs";
import "element-plus/es/components/empty/style/css.mjs";
import "element-plus/es/components/icon/style/css.mjs";
import "element-plus/es/components/input/style/css.mjs";
import "element-plus/es/components/option/style/css.mjs";
import "element-plus/es/components/progress/style/css.mjs";
import "element-plus/es/components/segmented/style/css.mjs";
import "element-plus/es/components/select/style/css.mjs";
import "element-plus/es/components/slider/style/css.mjs";
import "element-plus/es/components/switch/style/css.mjs";
import "element-plus/es/components/tab-pane/style/css.mjs";
import "element-plus/es/components/tabs/style/css.mjs";
import "element-plus/es/components/tooltip/style/css.mjs";
import "./styles/main.css";
import App from "./App.vue";

const app = createApp(App);
// Element Plus 按需引入：只用到的组件进包，替代全量 import "element-plus"。
[
  ElConfigProvider,
  ElButton,
  ElDialog,
  ElEmpty,
  ElIcon,
  ElInput,
  ElOption,
  ElProgress,
  ElSegmented,
  ElSelect,
  ElSlider,
  ElSwitch,
  ElTabPane,
  ElTabs,
  ElTooltip
].forEach((plugin) => app.use(plugin));
app.mount("#app");
