# TSP Zabbix Widget JS Wrapper

This repository demonstrates how to integrate a standard JavaScript UMD module as a dashboard widget in Zabbix.

## Project Goal

The primary goal of this project is to provide a general-purpose Zabbix widget wrapper that:

- abstracts developers away from Zabbix-specific dashboard widget implementation details,
- reduces the need for deep Zabbix knowledge (standard JavaScript web component development in UMD format is enough),
- enables reuse of a large ecosystem of existing JavaScript visualization components.

Examples of possible ecosystem projects include:

- Apache ECharts: https://echarts.apache.org/
- DataTables: https://datatables.net/
- PrimeVue: https://primevue.org/
- Chart.js: https://www.chartjs.org/
- D3.js: https://d3js.org/
- Plotly.js: https://plotly.com/javascript/
- Highcharts: https://www.highcharts.com/
- ApexCharts: https://apexcharts.com/

## Repository Structure

- `js_wrapper/`
  - PHP project containing the Zabbix plugin (wrapper) that connects a UMD module to the Zabbix widget runtime.
  - Includes widget code, assets, and integration logic for running inside Zabbix.

- `example_UMD_module/`
  - Reference JavaScript UMD module intended to be used with the Zabbix wrapper.
  - Serves as a practical example of module structure and build workflow.

- `debug_UMD_module/`
  - Diagnostics UMD module (TypeScript): renders the payload the wrapper passes to a
    module, counts update cycles, and offers a live test button for the `zbx.api`
    host API.
  - The first thing to deploy when a module of your own misbehaves.

## Documentation

This root README is intentionally high-level.

Detailed documentation is provided in README files inside each directory:

- `js_wrapper/README.md`
- `example_UMD_module/README.md`
- `debug_UMD_module/README.md`

## License

MIT - see `LICENSE`. Copyright (c) 2026 TSP Data a.s.

The `js_wrapper` module's own code contains no third-party libraries. The prebuilt example and
debug modules shipped in `js_wrapper/assets/umd/` bundle third-party libraries under their own
permissive licenses: [Vue](https://github.com/vuejs/core) (MIT) in both, and in `example.umd.js`
also [Apache ECharts](https://github.com/apache/echarts) (Apache-2.0) with its dependencies
[ZRender](https://github.com/ecomfe/zrender) (BSD-3-Clause) and
[tslib](https://github.com/microsoft/tslib) (0BSD). Their copyright notices are in the packages'
own `LICENSE` files (see `node_modules/` in `example_UMD_module/` and `debug_UMD_module/` after
`npm install`). The `NOTICE` file of Apache ECharts reads:

```text
Apache ECharts
Copyright 2017-2025 The Apache Software Foundation

This product includes software developed at
The Apache Software Foundation (https://www.apache.org/).
```
