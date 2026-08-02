// Minimal shim for browser environment (Zabbix frontend).
// Vue (bundler builds) and some libs reference process.env.NODE_ENV.
window.process = window.process || { env: {} };
window.process.env = window.process.env || {};
window.process.env.NODE_ENV = window.process.env.NODE_ENV || 'production';
