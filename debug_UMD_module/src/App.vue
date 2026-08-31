<script setup lang="ts">
import { computed, inject, ref } from 'vue'

/**
 * Diagnostics view of everything the wrapper hands to a module: the parsed
 * configuration, the runtime context, the zbx host API, and how many update
 * cycles have arrived. Point a widget at component "debug" to see exactly what
 * your own module would receive.
 */

interface WidgetState {
  conf: unknown
  context: unknown
  zbx: unknown
  updates: number
}

/** Provided by entry.ts (wrapper mode) or main.ts (local dev). */
const state = inject<WidgetState>('widgetState', {
  conf: { note: 'no widgetState provided - standalone mode' },
  context: {},
  zbx: {},
  updates: 0,
})

/**
 * zbx.api does not show up in the rendered JSON - functions do not serialize -
 * so it gets its own row and a live test button instead.
 */
const zbxApi = computed(() => {
  const api = (state.zbx as Record<string, unknown> | null)?.api
  return typeof api === 'function'
    ? (api as (method: string, params?: unknown) => Promise<unknown>)
    : null
})

const apiResult = ref('')
const apiBusy = ref(false)

/**
 * One call through the host API, with the raw outcome displayed either way.
 * apiinfo.version is used because it needs no parameters, no permissions and
 * returns something recognizable.
 */
async function testHostApi() {
  if (!zbxApi.value) return

  apiBusy.value = true
  apiResult.value = ''

  try {
    const version = await zbxApi.value('apiinfo.version', {})
    apiResult.value = `OK: ${JSON.stringify(version)}`
  } catch (e) {
    apiResult.value = `ERROR: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    apiBusy.value = false
  }
}
</script>

<template>
  <div class="widget-root">
    <h2>DEBUG - wrapper payload displayed</h2>

    <section>
      <h3>conf</h3>
      <pre>{{ state.conf }}</pre>
    </section>

    <section>
      <h3>context</h3>
      <pre>{{ state.context }}</pre>
    </section>

    <section>
      <h3>zbx</h3>
      <pre>{{ state.zbx }}</pre>
      <p class="line">
        <code>zbx.api</code>:
        <template v-if="zbxApi">
          present
          <button type="button" :disabled="apiBusy" @click="testHostApi">
            {{ apiBusy ? 'calling…' : 'call apiinfo.version' }}
          </button>
          <span v-if="apiResult" :class="apiResult.startsWith('OK') ? 'ok' : 'bad'">
            {{ apiResult }}
          </span>
        </template>
        <template v-else>not offered (a function would not serialize above anyway)</template>
      </p>
    </section>

    <section>
      <h3>update cycles</h3>
      <p class="line">{{ state.updates }} since mount</p>
    </section>
  </div>
</template>

<style scoped>
.widget-root {
  padding: 8px;
  overflow: auto;
  height: 100%;
  box-sizing: border-box;
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    Oxygen,
    Ubuntu,
    Cantarell,
    'Open Sans',
    'Helvetica Neue',
    sans-serif;
}

section {
  margin-top: 12px;
}

pre {
  background: #f5f5f5;
  border: 1px solid #ddd;
  padding: 8px;
  font-size: 12px;
  overflow: auto;
}

.line {
  font-size: 12px;
  margin: 4px 0 0;
}

.ok {
  color: #1a7a1a;
}

.bad {
  color: #b30000;
}

button {
  font: inherit;
  font-size: 12px;
  margin: 0 6px;
  padding: 1px 8px;
  cursor: pointer;
}

button:disabled {
  cursor: default;
}
</style>
