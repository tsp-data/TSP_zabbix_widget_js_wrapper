// src/entry.ts
import { createApp, reactive } from 'vue'
import App from './App.vue'

/**
 * Component name as it will be referenced by the Zabbix wrapper.
 * Must match "Component name" in widget edit form.
 */
const COMPONENT_NAME = 'debug'

/** Payload the wrapper passes to mount() and update(). */
export interface ZbxWidgetPayload {
  conf?: unknown
  context?: unknown
  zbx?: unknown
}

/**
 * Widget instance returned by mount(). destroy() is required; update() is
 * recommended - without it the wrapper remounts the module on every refresh cycle.
 */
export interface ZbxWidgetInstance {
  destroy(): void
  update?: (payload: ZbxWidgetPayload) => void
}

/**
 * Contract expected by the Zabbix wrapper:
 * window[COMPONENT_NAME] = { mount(el, payload) => instance }
 */
export interface ZbxWidgetComponent {
  mount: (el: HTMLElement, payload: ZbxWidgetPayload) => ZbxWidgetInstance
}

const api: ZbxWidgetComponent = {
  mount(el, { conf, context, zbx }) {
    // Shared reactive state injected into App.vue, updated by the wrapper's
    // refresh cycle through update() below. The counter makes those cycles
    // visible, which is the point of a diagnostics widget.
    const widgetState = reactive({
      conf: conf ?? {},
      context: context ?? {},
      zbx: zbx ?? {},
      updates: 0,
    })

    const app = createApp(App)
    app.provide('widgetState', widgetState)
    app.mount(el)

    return {
      destroy() {
        app.unmount()
      },
      update(payload: ZbxWidgetPayload = {}) {
        widgetState.conf = payload.conf ?? {}
        widgetState.context = payload.context ?? {}
        widgetState.zbx = payload.zbx ?? {}
        widgetState.updates++
      },
    }
  },
}

// Publish as window.debug (or whatever COMPONENT_NAME is)
;(window as unknown as Record<string, unknown>)[COMPONENT_NAME] = api
