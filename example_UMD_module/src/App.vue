<script setup>
import { inject, ref, onMounted, onBeforeUnmount, watch } from 'vue'
// ECharts is a popular charting library. You can use any other library or vanilla canvas/svg.
// Whole ECharst library is imported here for simplicity, but you can optimize by importing only necessary modules/components.
import * as echarts from 'echarts'

// Vue component props are not used in this example, but you can pass any configuration or context data from Zabbix to the widget via props or inject/provide mechanism.
const props = defineProps({
  conf: { type: null, required: false },
  context: { type: null, required: false },
  zbx: { type: null, required: false },
})

console.log('Widget props:', props)

// Widget state is injected from Zabbix. It is used as a signal form zabbix to update chart. It can also contain any configuration or context data you need for rendering. In this example, we just log it and trigger chart redraw on changes.
const state = inject('widgetState', {
  conf: {},
  context: {},
  zbx: {},
})

// DOM element for ECharts instance.
const chartEl = ref(null)
let chart = null
let resizeObserver = null

// Base chart configuration. Every render keeps this structure
// and replaces only data with fresh random values.
const defaultOption = {
  xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
  yAxis: { type: 'value' },
  series: [{ type: 'line', data: [0, 0, 0, 0, 0, 0, 0] }],
}

function makeRandomSeriesData(length = 7) {
  return Array.from({ length }, () => Math.floor(Math.random() * 100))
}

// Render chart with new random data. In real use case, the data will be taken from Zabbix API
function render() {
  if (!chart) return

  const randomData = makeRandomSeriesData()
  const nextOption = {
    ...defaultOption,
    series: [{ ...defaultOption.series?.[0], data: randomData }],
  }

  chart.setOption(nextOption, true)
}

function resize() {
  if (!chart) return
  chart.resize()
}

onMounted(() => {
  // Initialize chart once component is mounted.
  chart = echarts.init(chartEl.value)
  render()

  // Keep chart dimensions in sync with container/window changes.
  resizeObserver = new ResizeObserver(() => resize())
  resizeObserver.observe(chartEl.value)

  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  // Release listeners/observers and chart instance to prevent leaks.
  window.removeEventListener('resize', resize)

  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  if (chart) {
    chart.dispose()
    chart = null
  }
})

// Zabbix wrapper updates `state.conf`; watch acts only as a redraw trigger.
watch(
  () => state.conf,
  () => render(),
  { deep: true },
)
</script>

<template>
  <div ref="chartEl" class="chart"></div>
</template>

<style scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
